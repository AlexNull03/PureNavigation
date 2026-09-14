"""一次网站判别的编排：规范化地址 → whois → 证书 → 启发式红旗。"""

from __future__ import annotations

from dataclasses import dataclass

from server.heuristics import Flag, analyze, match_brand, official_match
from server.netguard import DnsError, Target, normalize_target, resolve_public
from server.tls import CertInfo, inspect_cert
from server.whois import WhoisResult, lookup


@dataclass(frozen=True)
class ScanResult:
    target: Target
    addresses: tuple[str, ...]
    whois: WhoisResult
    cert: CertInfo
    flags: tuple[Flag, ...]

    def evidence_text(self) -> str:
        lines = [
            f"提交地址：{self.target.origin}",
            f"解析到的公网 IP：{', '.join(self.addresses) or '无'}",
            f"主域：{self.target.registrable}（后缀 .{self.target.tld}）",
        ]
        official = official_match(self.target)
        if official is not None:
            lines.append(f"数据库命中：这就是「{official.name}」的官方域名 {official.domain}")
        suspect = match_brand(self.target)
        if suspect is not None and official is None:
            lines.append(
                f"疑似仿冒：与「{suspect[0].name}」官方域 {suspect[0].domain} 相似度 {suspect[1]:.0%}"
            )
        if self.whois.ok:
            lines += [
                f"注册商：{self.whois.registrar or '未返回'}",
                f"注册时间：{self.whois.created or '未返回'}",
                f"到期时间：{self.whois.expires or '未返回'}",
                f"域名状态：{', '.join(self.whois.status) or '未返回'}",
                f"域名服务器：{', '.join(self.whois.nameservers[:4]) or '未返回'}",
            ]
        else:
            lines.append(f"whois：未取得有效记录（{self.whois.error}）")
        if self.cert.https:
            lines += [
                f"证书主体：{self.cert.subject_cn or '无'}",
                f"颁发给：{', '.join(self.cert.san_dns[:4]) or '无'}（覆盖当前主机：{self.cert.san_covers_host}）",
                f"签发者：{self.cert.issuer_cn or '无'} / {self.cert.issuer_org or '无组织名'}",
                f"签发链：{' → '.join(self.cert.chain) or '未能重建'}",
                f"有效期：{self.cert.not_before} ~ {self.cert.not_after}（剩余 {self.cert.days_left} 天）",
                f"浏览器是否信任：{self.cert.trusted}",
                f"TLS 版本：{self.cert.tls_version}",
            ]
        else:
            lines.append(f"HTTPS：不可用（{self.cert.error}）")
        for flag in self.flags:
            lines.append(f"红旗[{flag.level}] {flag.text}")
        return "\n".join(lines)

    def to_dict(self) -> dict[str, object]:
        return {
            "origin": self.target.origin,
            "host": self.target.host,
            "registrable": self.target.registrable,
            "tld": self.target.tld,
            "addresses": list(self.addresses),
            "whois": self.whois.to_dict(),
            "cert": self.cert.to_dict(),
            "official": (
                {"name": official_match(self.target).name, "domain": official_match(self.target).domain}
                if official_match(self.target) is not None else None
            ),
            "suspect_brand": (
                {"name": match_brand(self.target)[0].name,
                 "similarity": round(match_brand(self.target)[1], 3)}
                if match_brand(self.target) is not None else None
            ),
            "flags": [{"level": f.level, "text": f.text} for f in self.flags],
        }


def scan(raw: str) -> ScanResult:
    target = normalize_target(raw)
    dns_error = ""
    try:
        addresses = tuple(resolve_public(target.host))
    except DnsError as exc:
        # whois 走注册局的 43 端口，不需要目标可解析；域名已死恰恰是仿冒站下架后的常见形态。
        addresses = ()
        dns_error = str(exc)

    whois = lookup(target.registrable, target.tld)
    cert = inspect_cert(target.host)
    flags = list(analyze(target, whois, cert))
    if dns_error:
        flags.insert(0, Flag("high", f"{dns_error}，这个域名当前不指向任何服务器"))
    return ScanResult(
        target=target,
        addresses=addresses,
        whois=whois,
        cert=cert,
        flags=tuple(flags),
    )
