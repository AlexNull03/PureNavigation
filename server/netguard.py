"""扫描目标的规范化与 SSRF 防护。

本服务会对用户提交的地址主动发起 TCP 连接，因此必须在连接前把目标
限制成"公网、仅 80/443、仅 http/https"，否则服务器会变成内网探测器。
"""

from __future__ import annotations

import ipaddress
import re
import socket
from dataclasses import dataclass
from urllib.parse import urlsplit

ALLOWED_SCHEMES = frozenset({"http", "https"})
ALLOWED_PORTS = frozenset({80, 443})
_LABEL = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")
# 刻意不含点号：否则 example.com:8443 会被当成协议名，报错信息就跑偏了。
_SCHEME_PREFIX = re.compile(r"^([a-zA-Z][a-zA-Z0-9+-]{1,31}):")

# 常见多级公共后缀。缺了它会把 example.co.uk 的主域算成 co.uk，
# 品牌仿冒比对就会失真。只需覆盖本站用户实际会提交的类型。
MULTI_PART_SUFFIXES = frozenset(
    {
        "co.uk", "org.uk", "me.uk", "net.uk", "ac.uk", "gov.uk",
        "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn", "ac.cn",
        "com.au", "net.au", "org.au", "edu.au",
        "co.jp", "or.jp", "ne.jp", "ac.jp", "go.jp",
        "co.kr", "or.kr", "ne.kr",
        "com.br", "net.br", "org.br",
        "com.tw", "org.tw", "edu.tw",
        "com.hk", "org.hk", "idv.hk",
        "com.sg", "com.my", "com.ph", "co.in", "com.tr", "com.ru",
        "com.ua", "com.pl", "co.za", "com.mx", "com.ar", "com.co",
    }
)


class TargetError(ValueError):
    """目标地址不合法或不被允许扫描。"""


@dataclass(frozen=True)
class Target:
    host: str
    scheme: str
    port: int
    registrable: str
    tld: str
    labels: tuple[str, ...]

    @property
    def origin(self) -> str:
        default = 443 if self.scheme == "https" else 80
        if self.port == default:
            return f"{self.scheme}://{self.host}"
        return f"{self.scheme}://{self.host}:{self.port}"


def is_ip_literal(text: str) -> bool:
    try:
        ipaddress.ip_address(text)
    except ValueError:
        return False
    return True


def _is_public_ip(text: str) -> bool:
    if not is_ip_literal(text):
        return False
    address = ipaddress.ip_address(text)
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
        or address.is_unspecified
    )


def registrable_domain(host: str) -> str:
    """取主域：example.co.uk → example.co.uk，a.b.python.org → python.org。"""
    labels = tuple(host.lower().strip(".").split("."))
    if len(labels) < 2:
        return labels[0] if labels else ""
    if len(labels) >= 3 and ".".join(labels[-2:]) in MULTI_PART_SUFFIXES:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def _registrable(host: str) -> tuple[str, str, tuple[str, ...]]:
    labels = tuple(host.split("."))
    return registrable_domain(host), labels[-1] if labels else "", labels


def normalize_target(raw: str) -> Target:
    """接受 `example.com/x` 或完整 URL，产出可安全扫描的 Target。"""
    text = raw.strip()
    if not text:
        raise TargetError("地址为空")
    if len(text) > 300:
        raise TargetError("地址过长")

    explicit = _SCHEME_PREFIX.match(text)
    if explicit:
        if explicit.group(1).lower() not in ALLOWED_SCHEMES:
            raise TargetError(f"只支持 http/https，收到 {explicit.group(1).lower()}")
    else:
        text = f"https://{text}"

    parts = urlsplit(text)
    scheme = parts.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise TargetError(f"只支持 http/https，收到 {scheme or '未知协议'}")

    host = (parts.hostname or "").strip(".").lower()
    if not host:
        raise TargetError("无法从内容中识别出域名")

    try:
        port = parts.port
    except ValueError as exc:
        raise TargetError("端口写法不正确") from exc
    if port is None:
        port = 443 if scheme == "https" else 80
    if port not in ALLOWED_PORTS:
        raise TargetError("只允许扫描 80/443 端口")

    if is_ip_literal(host):
        if not _is_public_ip(host):
            raise TargetError("不允许扫描内网或保留地址")
        raise TargetError("请输入域名而不是 IP，以便核对证书与备案主体")

    labels = host.split(".")
    if len(labels) < 2 or not all(_LABEL.match(label) for label in labels):
        raise TargetError("域名格式不正确")

    registrable, tld, tupled = _registrable(host)
    return Target(
        host=host,
        scheme=scheme,
        port=port,
        registrable=registrable,
        tld=tld,
        labels=tupled,
    )


def resolve_public(host: str) -> list[str]:
    """解析并确认全部结果都是公网地址。"""
    try:
        infos = socket.getaddrinfo(host, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise TargetError(f"域名解析失败：{exc.strerror or 'NXDOMAIN'}") from exc

    addresses = sorted({info[4][0] for info in infos})
    if not addresses:
        raise TargetError("域名没有解析结果")
    if not all(_is_public_ip(address) for address in addresses):
        raise TargetError("该域名指向内网或保留地址，已拒绝扫描")
    return addresses
