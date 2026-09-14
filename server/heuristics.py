"""域名风险提示：把 whois + 证书 + 域名形态三类事实合成一组可解释的红线。

这里刻意只做**确定性规则**，不猜结论；判断交给 LLM，规则负责保证它不会
漏掉关键事实（新注册域、不受信证书、仿冒主域等）。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime

from server.catalog import Software, catalog
from server.netguard import Target
from server.tls import CertInfo
from server.whois import WhoisResult

HIGH_ABUSE_TLDS = frozenset({
    "xyz", "top", "icu", "cyou", "sbs", "vip", "club", "work", "loan",
    "click", "link", "pw", "cc", "buzz", "site", "shop", "online", "fit",
    "rest", "quest", "monster", "beauty", "autos",
})

BRAND_NOISE = ("download", "downloads", "soft", "rj", "guanwang", "official",
               "install", "get", "app", "pc", "windows", "zh", "cn")

_GLYPH = str.maketrans({"0": "o", "1": "l", "3": "e", "5": "s", "8": "b", "@": "a"})
_NON_LABEL = re.compile(r"[^a-z0-9]")


@dataclass(frozen=True)
class Flag:
    level: str  # ok | high | medium | low
    text: str


def _edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            current.append(min(previous[j] + 1, current[j - 1] + 1,
                               previous[j - 1] + (ca != cb)))
        previous = current
    return previous[-1]


def _canonical(label: str) -> str:
    """去掉公共后缀、连字符、下载站惯用噪音，并把形近字符折回字母。"""
    text = _NON_LABEL.sub("", label.lower())
    text = text.translate(_GLYPH)
    for noise in BRAND_NOISE:
        text = text.replace(noise, "")
    return text


def _similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    distance = _edit_distance(a, b)
    return 1.0 - distance / max(len(a), len(b))


def _brand_label(domain: str) -> str:
    return domain.rsplit(".", 1)[0] if "." in domain else domain


def match_brand(target: Target) -> tuple[Software, float] | None:
    """返回被仿冒嫌疑最大的官方条目及其相似度。"""
    raw_candidate = _brand_label(target.registrable).lower()
    candidate = _canonical(raw_candidate)
    best: tuple[Software, float] | None = None
    for item in catalog():
        raw_official = _brand_label(item.domain).lower()
        official = _canonical(raw_official)
        if not official or not candidate:
            continue
        # 判等只看原始拼写：折叠形式相等恰恰意味着"像但不是"，不能放过。
        if raw_candidate == raw_official:
            return None
        score = _similarity(candidate, official)
        if candidate in official or official in candidate:
            score = max(score, 0.86)
        if score > 0.62 and (best is None or score > best[1]):
            best = (item, score)
    return best


def _age_days(created: str) -> int | None:
    if len(created) < 10 or created[4] != "-":
        return None
    try:
        registered = datetime.strptime(created[:10], "%Y-%m-%d").date()
    except ValueError:
        return None
    return (date.today() - registered).days


def _domain_flags(target: Target) -> list[Flag]:
    flags: list[Flag] = []
    brand = target.registrable.rsplit(".", 1)[0]
    if target.registrable.startswith("xn--") or ".xn--" in target.registrable:
        flags.append(Flag("high", "域名使用 Punycode 同形字符，是仿冒官网最常见的手法"))
    if target.tld in HIGH_ABUSE_TLDS:
        flags.append(Flag("medium", f".{target.tld} 属于滥用率高的后缀，正规厂商极少使用"))
    if brand.count("-") >= 2:
        flags.append(Flag("medium", f"主域含多个连字符（{brand}），官方品牌域名单很少这样"))
    if any(noise in brand for noise in BRAND_NOISE):
        flags.append(Flag("medium", "主域里混入 download/soft/official 一类引流词，像是 SEO 抢排名站"))
    return flags


def _whois_flags(target: Target, whois: WhoisResult) -> list[Flag]:
    flags: list[Flag] = []
    if not whois.ok:
        flags.append(Flag("low", f"whois 未取得有效记录：{whois.error or '注册局无数据'}"))
        return flags
    age = _age_days(whois.created)
    if age is not None:
        if age < 90:
            flags.append(Flag("high", f"域名仅注册 {age} 天，正规软件官网不会这么新"))
        elif age < 365:
            flags.append(Flag("medium", f"域名注册时间 {age} 天，不足一年"))
        else:
            flags.append(Flag("low", f"域名已注册 {age} 天（{whois.created}）"))
    if not whois.registrar:
        flags.append(Flag("low", "whois 未返回注册商名称"))
    if "clienthold" in " ".join(whois.status).lower() or "serverhold" in " ".join(whois.status).lower():
        flags.append(Flag("medium", "域名处于 hold 状态，随时可能停止解析"))
    if not whois.nameservers:
        flags.append(Flag("medium", "whois 未列出任何域名服务器"))
    return flags


def _cert_flags(cert: CertInfo) -> list[Flag]:
    if not cert.https:
        return [Flag("high", f"443 端口不可用，站点没有可用的 HTTPS：{cert.error}")]
    flags: list[Flag] = []
    if not cert.trusted:
        flags.append(Flag("high", f"证书不受任何 CA 信任：{cert.error or '校验失败'}"))
    if cert.self_signed:
        flags.append(Flag("high", "证书为自签名，签名主体与被签名主体相同"))
    if not cert.san_covers_host:
        flags.append(Flag("high", f"证书签发的域名（{', '.join(cert.san_dns[:3]) or '无'}）不覆盖当前主机"))
    if not cert.chain:
        flags.append(Flag("medium", "未能重建签发链，服务器未出示中间证书且无 AIA 地址"))
    if cert.not_before and cert.not_after:
        span = _span_days(cert.not_before, cert.not_after)
        if 0 < span < 30:
            flags.append(Flag("medium", f"证书有效期仅 {span} 天，像是随时准备丢弃的一次性域名"))
    return flags


def _span_days(start: str, end: str) -> int:
    try:
        return (datetime.strptime(end[:10], "%Y-%m-%d").date()
                - datetime.strptime(start[:10], "%Y-%m-%d").date()).days
    except ValueError:
        return 0


def official_match(target: Target) -> Software | None:
    """当前主域是否就是数据库里某个软件的官方主域。"""
    for item in catalog():
        if item.domain and item.domain == target.registrable:
            return item
    return None


def analyze(target: Target, whois: WhoisResult, cert: CertInfo) -> list[Flag]:
    flags: list[Flag] = []
    official = official_match(target)
    if official is not None:
        flags.append(Flag("ok", f"主域 {target.registrable} 与数据库里「{official.name}」的官方主域一致"))
        return flags

    suspect = match_brand(target)
    if suspect is not None:
        item, score = suspect
        flags.append(Flag(
            "high",
            f"主域与「{item.name}」官方域名 {item.domain} 高度相似（相似度 {score:.0%}）"
            f"但并不是它，典型仿冒形态",
        ))
    flags.extend(_domain_flags(target))
    flags.extend(_whois_flags(target, whois))
    flags.extend(_cert_flags(cert))
    return flags
