"""软件目录：db/data.csv 的读取、缓存、检索与「回复里提到了哪些已登记工具」的匹配。

CSV 是唯一数据源，十四列固定：
软件名,官方主页,下载直链,该软件功能与描述,分区,常见伪造官网与链接,通俗化解释,
安装基本流程,特别注意事项,普遍错误与后果,安装成功验证,使用简介与Hello World,
多版本下载,架构选择指导

单元格内允许换行（安装流程按行分步），所以解析必须走 StringIO 整本文本，
不能用 splitlines —— 后者会把引号内的多行字段切碎。
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from urllib.parse import urlsplit

from server.netguard import is_ip_literal, registrable_domain

EXPECTED_HEADER = [
    "软件名",
    "官方主页",
    "下载直链",
    "该软件功能与描述",
    "分区",
    "常见伪造官网与链接",
    "通俗化解释",
    "安装基本流程",
    "特别注意事项",
    "普遍错误与后果",
    "安装成功验证",
    "使用简介与Hello World",
    "多版本下载",
    "架构选择指导",
]

CATEGORY_SEPARATOR = ";"
DOWNLOAD_FIELD_SEPARATOR = "|"


@dataclass(frozen=True)
class Download:
    """一条「某平台 + 某架构」的官方获取入口。

    链接一律取自 CSV，后端不拼 URL —— 拼出来的地址看着像真的，反而最危险。
    """

    platform: str
    arch: str
    url: str

    def to_dict(self) -> dict[str, str]:
        return {"platform": self.platform, "arch": self.arch, "url": self.url}


@dataclass(frozen=True)
class Software:
    name: str
    homepage: str
    download: str
    description: str
    categories: tuple[str, ...]
    fakes: str
    plain_explain: str
    install_steps: str
    cautions: str
    common_errors: str
    verify: str
    hello_world: str
    downloads: tuple[Download, ...]
    arch_guide: str
    domain: str
    host: str

    def to_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "homepage": self.homepage,
            "download": self.download,
            "description": self.description,
            "categories": list(self.categories),
            "fakes": self.fakes,
            "plain_explain": self.plain_explain,
            "install_steps": self.install_steps,
            "cautions": self.cautions,
            "common_errors": self.common_errors,
            "verify": self.verify,
            "hello_world": self.hello_world,
            "downloads": [entry.to_dict() for entry in self.downloads],
            "arch_guide": self.arch_guide,
            "domain": self.domain,
            "host": self.host,
        }


def _parse_downloads(text: str) -> tuple[Download, ...]:
    """「平台|架构|链接」逐行解析；不合规的行直接丢掉而不是让整张表报错。

    丢行是有意的宽松：这一列只影响展示，不能让一个少写字段的行把 /api/software 打成 500。
    """
    entries: list[Download] = []
    for line in text.splitlines():
        parts = [part.strip() for part in line.split(DOWNLOAD_FIELD_SEPARATOR)]
        if len(parts) != 3 or not parts[2].startswith("http"):
            continue
        entries.append(Download(platform=parts[0], arch=parts[1], url=parts[2]))
    return tuple(entries)


@cache
def data_path() -> Path:
    return Path(__file__).resolve().parent.parent / "db" / "data.csv"


def _domains(url: str) -> tuple[str, str]:
    """返回 (主域, host)。主域用于品牌比对，host 用于展示。"""
    host = (urlsplit(url).hostname or "").lower().strip(".")
    if not host:
        return "", host
    if is_ip_literal(host):
        return host, host
    return registrable_domain(host), host


def _parse(version: float) -> tuple[Software, ...]:
    path = data_path()
    if not path.exists():
        raise FileNotFoundError(f"数据文件缺失：{path}")
    rows = list(csv.reader(io.StringIO(path.read_text(encoding="utf-8"))))
    if not rows or rows[0] != EXPECTED_HEADER:
        raise ValueError(f"data.csv 表头不符：{rows[0] if rows else '空文件'}")

    items: list[Software] = []
    for row in rows[1:]:
        if len(row) != len(EXPECTED_HEADER):
            continue
        (
            name,
            homepage,
            download,
            description,
            categories,
            fakes,
            plain_explain,
            install_steps,
            cautions,
            common_errors,
            verify,
            hello_world,
            downloads,
            arch_guide,
        ) = (cell.strip() for cell in row)
        if not name or not homepage:
            continue
        domain, host = _domains(homepage)
        items.append(
            Software(
                name=name,
                homepage=homepage,
                download=download,
                description=description,
                categories=tuple(
                    part.strip()
                    for part in categories.split(CATEGORY_SEPARATOR)
                    if part.strip()
                ),
                fakes=fakes,
                plain_explain=plain_explain,
                install_steps=install_steps,
                cautions=cautions,
                common_errors=common_errors,
                verify=verify,
                hello_world=hello_world,
                downloads=_parse_downloads(downloads),
                arch_guide=arch_guide,
                domain=domain,
                host=host,
            )
        )
    return tuple(items)


def catalog() -> tuple[Software, ...]:
    """按文件 mtime 自动失效的目录缓存。"""
    return _parse(data_path().stat().st_mtime)


_TOKEN = re.compile(r"[a-z0-9\u4e00-\u9fff]+")


def _tokens(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def search(items: tuple[Software, ...], query: str) -> list[Software]:
    """多词相加、字段取最高权重。名称命中优先，描述垫底。"""
    terms = _tokens(query)
    if not terms:
        return list(items)

    weights = (("name", 100), ("domain", 90), ("host", 70), ("description", 10))
    ranked: list[tuple[int, Software]] = []
    for item in items:
        score = 0
        for term in terms:
            best = 0
            for weight_field, weight in weights:
                value = getattr(item, weight_field).lower()
                if value == term:
                    best = max(best, int(weight * 1.5))
                elif term in value:
                    best = max(best, weight)
            score += best
        if score:
            ranked.append((score, item))
    ranked.sort(key=lambda pair: -pair[0])
    return [item for _, item in ranked]


# —— AI 回复 → 已登记工具 ——
#
# 模型的回答里出现某个工具的别名时，前端会在回答下方挂出该工具的简介卡片。
# 别名匹配用“非字母数字边界”而不是 \b：中文紧邻也算边界（“装python吗”要能命中）。
# 常见泛用词（node / git / idea 一类）单独权衡过取舍，见各行注释。
_ALIAS_TABLE: dict[str, tuple[str, ...]] = {
    "Python 3.13": ("python",),
    "Visual Studio Code": ("visual studio code", "vs code", "vscode"),
    "Steam": ("steam",),
    "Visual Studio Community": ("visual studio",),
    "PyCharm Community": ("pycharm",),
    "IntelliJ IDEA Community": ("intellij",),
    "Qoder": ("qoder",),
    "Trae": ("trae",),
    "Cursor": ("cursor",),
    "Git": ("git",),
    "Node.js": ("node.js", "nodejs", "node"),
    "Eclipse Temurin JDK": ("temurin", "jdk", "adoptium"),
    "Docker Desktop": ("docker",),
    "PostgreSQL": ("postgresql", "postgres"),
    "Anaconda": ("anaconda",),
    "Ollama": ("ollama",),
    "LM Studio": ("lm studio", "lmstudio"),
    "FFmpeg": ("ffmpeg",),
    "VLC media player": ("vlc",),
    "7-Zip": ("7-zip", "7zip"),
    "Notepad++": ("notepad++", "notepadplus"),
    "Everything": ("Everything",),
    "Rufus": ("rufus",),
    "Blender": ("blender",),
    "VMware Workstation Pro": ("vmware workstation", "vmware"),
    "VirtualBox": ("virtualbox", "virtual box"),
    # 「沙盒」在日常中文里太泛（浏览器沙盒、Android 沙盒），只认带 Windows 的写法。
    "Windows Sandbox": ("windows sandbox", "windows 沙盒", "windows沙盒"),
    "PowerToys": ("powertoys", "power toys"),
}

# everything 这个小写词在英文句子里太常见（“install everything”），
# 所以这一个别名要求原样大小写命中，其余别名一律忽略大小写。
_CASE_SENSITIVE = frozenset({"Everything"})


@cache
def _alias_patterns() -> tuple[tuple[str, re.Pattern[str]], ...]:
    """按别名长度降序编译；先长后短，配合包含去重防 'visual studio' 抢掉 'visual studio code'。"""
    pairs: list[tuple[str, re.Pattern[str]]] = []
    for name, aliases in _ALIAS_TABLE.items():
        for alias in aliases:
            pattern = re.compile(
                r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9+#])",
                0 if alias in _CASE_SENSITIVE else re.IGNORECASE,
            )
            pairs.append((name, pattern))
    pairs.sort(key=lambda pair: len(pair[1].pattern), reverse=True)
    return tuple(pairs)


def mentioned(reply: str, items: tuple[Software, ...] | None = None) -> list[Software]:
    """从 AI 回复文本里认出被推荐的已登记工具，按目录顺序返回。"""
    if not reply:
        return []
    pool = items if items is not None else catalog()

    spans: list[tuple[str, int, int]] = []
    for name, pattern in _alias_patterns():
        for match in pattern.finditer(reply):
            spans.append((name, match.start(), match.end()))

    # 短的命中若被另一条不同工具的更长命中包住（visual studio ⊂ visual studio code），丢弃。
    chosen: list[tuple[str, int, int]] = []
    for name, start, end in spans:
        covered = any(
            other_name != name
            and other_start <= start
            and end <= other_end
            for other_name, other_start, other_end in spans
        )
        if not covered:
            chosen.append((name, start, end))

    seen = {name for name, _, _ in chosen}
    return [item for item in pool if item.name in seen]
