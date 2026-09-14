"""TLS 证书链探测。

判别仿冒站时，证书是最难伪造的信号之一：页面能抄，python.org 的 DV 证书
抄不走。这里做两次握手——一次开启校验（得出"浏览器是否信任"），一次关闭
校验（证书有问题也照样把它读出来）；然后沿证书的 AIA caIssuers 地址逐级
取回签发者证书，重建整条链。

不用 SSLSocket.get_verified_chain() 是因为它是 Python 3.13 才有的，
本机 3.12 拿不到，AIA 逐级取回在两个版本上都成立。
"""

from __future__ import annotations

import socket
import ssl
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlsplit

import httpx
from cryptography import x509
from cryptography.x509.oid import AuthorityInformationAccessOID, NameOID

from server.netguard import TargetError, resolve_public

HANDSHAKE_TIMEOUT = 8.0
AIA_TIMEOUT = 6.0
AIA_MAX_BYTES = 512_000
MAX_CHAIN_DEPTH = 4


@dataclass(frozen=True)
class CertInfo:
    https: bool
    host: str
    subject_cn: str = ""
    issuer_cn: str = ""
    issuer_org: str = ""
    not_before: str = ""
    not_after: str = ""
    days_left: int = 0
    valid_now: bool = False
    self_signed: bool = False
    trusted: bool = False
    san_dns: tuple[str, ...] = field(default_factory=tuple)
    san_covers_host: bool = False
    tls_version: str = ""
    chain: tuple[str, ...] = field(default_factory=tuple)
    chain_complete: bool = False
    error: str = ""

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _name_text(name: x509.Name, oid: x509.ObjectIdentifier) -> str:
    attributes = name.get_attributes_for_oid(oid)
    return attributes[0].value if attributes else ""


def _san_dns_names(cert: x509.Certificate) -> tuple[str, ...]:
    try:
        extension = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
    except x509.ExtensionNotFound:
        return ()
    return tuple(name.lower() for name in extension.value.get_values_for_type(x509.DNSName))


def _covers_host(san_names: tuple[str, ...], host: str) -> bool:
    for pattern in san_names:
        if pattern == host:
            return True
        if pattern.startswith("*."):
            suffix = pattern[1:]
            if host.endswith(suffix) and host.count(".") == pattern.count("."):
                return True
    return False


def _ca_issuers_url(cert: x509.Certificate) -> str:
    try:
        extension = cert.extensions.get_extension_for_class(x509.AuthorityInformationAccess)
    except x509.ExtensionNotFound:
        return ""
    for description in extension.value:
        if description.access_method == AuthorityInformationAccessOID.CA_ISSUERS:
            return str(description.access_location.value)
    return ""


def _fetch_der(url: str) -> bytes:
    """按 AIA 地址取回上级证书。只允许 http、只允许公网地址。"""
    parts = urlsplit(url)
    if parts.scheme != "http":
        return b""
    host = (parts.hostname or "").lower()
    if not host:
        return b""
    try:
        resolve_public(host)
    except TargetError:
        return b""
    with httpx.Client(timeout=AIA_TIMEOUT, follow_redirects=False) as client:
        response = client.get(url, headers={"Accept": "application/pkix-cert"})
    if response.status_code in (301, 302, 303, 307, 308):
        return b""
    if response.status_code != 200 or len(response.content) > AIA_MAX_BYTES:
        return b""
    return response.content


def build_chain(leaf: x509.Certificate) -> tuple[tuple[str, ...], bool]:
    """返回 (各级签发者 CN, 是否追到自签根)。"""
    names: list[str] = []
    current = leaf
    for _ in range(MAX_CHAIN_DEPTH):
        if current.subject == current.issuer:
            return tuple(names), True
        der = _fetch_der(_ca_issuers_url(current))
        if not der:
            return tuple(names), False
        try:
            parent = x509.load_der_x509_certificate(der)
        except ValueError:
            return tuple(names), False
        subject = _name_text(parent.subject, NameOID.COMMON_NAME)
        if subject and subject not in names:
            names.append(subject)
        current = parent
    return tuple(names), False


def _connect(host: str, context: ssl.SSLContext) -> tuple[bytes, str]:
    with socket.create_connection((host, 443), timeout=HANDSHAKE_TIMEOUT) as raw:
        with context.wrap_socket(raw, server_hostname=host) as tls:
            der = tls.getpeercert(True)
            if not der:
                raise ssl.SSLError("对端未出示证书")
            return der, tls.version() or ""


def _describe(
    host: str, der: bytes, version: str, trusted: bool, error: str
) -> CertInfo:
    cert = x509.load_der_x509_certificate(der)
    now = datetime.now(timezone.utc)
    san = _san_dns_names(cert)
    subject_cn = _name_text(cert.subject, NameOID.COMMON_NAME)
    issuer_cn = _name_text(cert.issuer, NameOID.COMMON_NAME)
    chain, complete = build_chain(cert)
    return CertInfo(
        https=True,
        host=host,
        subject_cn=subject_cn,
        issuer_cn=issuer_cn,
        issuer_org=_name_text(cert.issuer, NameOID.ORGANIZATION_NAME),
        not_before=cert.not_valid_before_utc.date().isoformat(),
        not_after=cert.not_valid_after_utc.date().isoformat(),
        days_left=(cert.not_valid_after_utc - now).days,
        valid_now=cert.not_valid_before_utc <= now < cert.not_valid_after_utc,
        self_signed=bool(subject_cn) and subject_cn == issuer_cn,
        trusted=trusted,
        san_dns=san[:12],
        san_covers_host=_covers_host(san, host),
        tls_version=version,
        chain=chain,
        chain_complete=complete,
        error=error,
    )


def inspect_cert(host: str) -> CertInfo:
    """返回证书事实。443 连不上时给出 https=False，不抛异常。"""
    try:
        der, version = _connect(host, ssl.create_default_context())
    except ssl.SSLCertVerificationError as exc:
        verify_error = exc.verify_message or str(exc)
        unverified = ssl.create_default_context()
        unverified.check_hostname = False
        unverified.verify_mode = ssl.CERT_NONE
        try:
            der, version = _connect(host, unverified)
        except OSError as retry_exc:
            reason = retry_exc.strerror or str(retry_exc)
            return CertInfo(
                https=False, host=host,
                error=f"证书不受信任（{verify_error}）；二次读取亦失败：{reason}",
            )
        return _describe(host, der, version, trusted=False, error=verify_error)
    except (OSError, ssl.SSLError) as exc:
        reason = exc.strerror or str(exc) or exc.__class__.__name__
        return CertInfo(https=False, host=host, error=f"无法建立 TLS 连接：{reason}")

    return _describe(host, der, version, trusted=True, error="")
