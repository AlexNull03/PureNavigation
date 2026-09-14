"""裸 TCP whois 客户端（43 端口）。

不依赖 python-whois：先问 IANA 引导服务器要该 TLD 的权威 whois 地址，
再向它查询主域，这样 .com / .cn / .dev 各种后缀都能走通。
"""

from __future__ import annotations

import re
import socket
from dataclasses import asdict, dataclass, field
from datetime import date

IANA_BOOTSTRAP = "whois.iana.org"
WHOIS_PORT = 43
QUERY_TIMEOUT = 8.0
MAX_BYTES = 64_000

_MONTHS = {
    name.lower(): index
    for index, name in enumerate(
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], start=1
    )
}

_NUMERIC_DATE = re.compile(r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})")
_MONTH_NAME_DATE = re.compile(r"(\d{1,2})[-. ]([A-Za-z]{3})[-. ](\d{4})")
_REFERRAL = re.compile(r"^whois:\s*(\S+)", re.MULTILINE | re.IGNORECASE)


@dataclass(frozen=True)
class WhoisResult:
    ok: bool
    queried_domain: str
    server: str = ""
    registrar: str = ""
    created: str = ""
    updated: str = ""
    expires: str = ""
    country: str = ""
    status: tuple[str, ...] = field(default_factory=tuple)
    nameservers: tuple[str, ...] = field(default_factory=tuple)
    excerpt: str = ""
    error: str = ""

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


# 每个字段按"从最具体到最宽泛"排列，命中第一个即用。全部小写。
_FIELD_KEYS: dict[str, tuple[str, ...]] = {
    "registrar": ("registrar:", "registrar of record:", "registered by:", "sponsoring registrar:"),
    "created": ("creation date:", "registration time:", "created on:", "domain create date:",
                "creat", "created:"),
    "updated": ("updated date:", "last modified:", "modified on:", "domain update date:",
                "changed:", "updated:"),
    "expires": ("registry expiry date:", "registrar expiration date:", "expiration date:",
                "expiry date:", "expiration time:", "expires on:", "renewal date:",
                "paid-till:", "expire"),
    "country": ("registrant country:", "country:"),
}

_NS_PREFIXES = ("name server:", "nameserver:", "nserver:", "host:")


def _query(server: str, text: str) -> str:
    with socket.create_connection((server, WHOIS_PORT), timeout=QUERY_TIMEOUT) as sock:
        sock.settimeout(QUERY_TIMEOUT)
        sock.sendall(f"{text}\r\n".encode("ascii", "ignore"))
        chunks: list[bytes] = []
        received = 0
        while received < MAX_BYTES:
            piece = sock.recv(4096)
            if not piece:
                break
            chunks.append(piece)
            received += len(piece)
    return b"".join(chunks).decode("utf-8", "replace")


def _referral_server(tld: str) -> tuple[str, str]:
    """返回 (权威 whois 服务器, 错误说明)，二者只有一个非空。"""
    body = _query(IANA_BOOTSTRAP, tld)
    match = _REFERRAL.search(body)
    if not match:
        return "", f"IANA 未提供 .{tld} 的 whois 服务器"
    return match.group(1).strip(".").lower(), ""


def _to_iso(raw: str) -> str:
    """把各家注册局的日期写法收敛成 YYYY-MM-DD，认不出就原样截断返回。"""
    if not raw:
        return ""
    numeric = _NUMERIC_DATE.search(raw)
    if numeric:
        year, month, day = (int(part) for part in numeric.groups())
        if 1 <= month <= 12 and 1 <= day <= 31 and 1980 <= year <= 2100:
            return date(year, month, day).isoformat()
    named = _MONTH_NAME_DATE.search(raw)
    if named:
        day, mon, year = named.groups()
        if mon.lower() in _MONTHS:
            return date(int(year), _MONTHS[mon.lower()], int(day)).isoformat()
    return raw[:32]


def _first_value(lines: list[str], keys: tuple[str, ...]) -> str:
    for key in keys:
        for line in lines:
            if line.lower().startswith(key):
                value = line.split(":", 1)[1].strip() if ":" in line else line[len(key):].strip()
                if value:
                    return value
    return ""


def _collect_lists(lines: list[str]) -> tuple[tuple[str, ...], tuple[str, ...]]:
    nameservers: list[str] = []
    statuses: list[str] = []
    for line in lines:
        lowered = line.lower()
        if lowered.startswith(_NS_PREFIXES):
            value = line.split(":", 1)[1].strip().lower()
            if value and value not in nameservers:
                nameservers.append(value)
        elif lowered.startswith("domain status:"):
            status = line.split(":", 1)[1].strip()
            if status and status not in statuses:
                statuses.append(status)
    return tuple(statuses[:6]), tuple(nameservers[:8])


def _build(domain: str, server: str, body: str) -> WhoisResult:
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    status, nameservers = _collect_lists(lines)
    return WhoisResult(
        ok=True,
        queried_domain=domain,
        server=server,
        registrar=_first_value(lines, _FIELD_KEYS["registrar"]),
        created=_to_iso(_first_value(lines, _FIELD_KEYS["created"])),
        updated=_to_iso(_first_value(lines, _FIELD_KEYS["updated"])),
        expires=_to_iso(_first_value(lines, _FIELD_KEYS["expires"])),
        country=_first_value(lines, _FIELD_KEYS["country"]),
        status=status,
        nameservers=nameservers,
        excerpt=body[-1500:],
    )


def lookup(domain: str, tld: str) -> WhoisResult:
    """查询主域注册信息。网络失败一律体现为 ok=False + error，不做静默兜底。"""
    server = IANA_BOOTSTRAP
    try:
        server, referral_error = _referral_server(tld)
        if not server:
            return WhoisResult(ok=False, queried_domain=domain, error=referral_error)
        body = _query(server, domain)
    except OSError as exc:
        reason = exc.strerror or str(exc) or exc.__class__.__name__
        return WhoisResult(
            ok=False, queried_domain=domain, server=server,
            error=f"whois 查询失败（{server}）：{reason}",
        )

    if not body.strip():
        return WhoisResult(
            ok=False, queried_domain=domain, server=server, error="注册局返回空结果"
        )
    return _build(domain, server, body)
