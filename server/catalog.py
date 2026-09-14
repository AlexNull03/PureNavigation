"""软件目录：db/data.csv 的读取、缓存与检索。

CSV 是唯一数据源，四列固定：软件名,官方主页,下载直链,该软件功能与描述
"""

from __future__ import annotations

import csv
import re
from dataclasses import asdict, dataclass
from functools import cache
from pathlib import Path
from urllib.parse import urlsplit

from server.netguard import is_ip_literal, registrable_domain

EXPECTED_HEADER = ["软件名", "官方主页", "下载直链", "该软件功能与描述"]


@dataclass(frozen=True)
class Software:
    name: str
    homepage: str
    download: str
    description: str
    domain: str
    host: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


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
    rows = list(csv.reader(path.read_text(encoding="utf-8").splitlines()))
    if not rows or rows[0] != EXPECTED_HEADER:
        raise ValueError(f"data.csv 表头不符：{rows[0] if rows else '空文件'}")

    items: list[Software] = []
    for row in rows[1:]:
        if len(row) != 4:
            continue
        name, homepage, download, description = (cell.strip() for cell in row)
        if not name or not homepage:
            continue
        domain, host = _domains(homepage)
        items.append(
            Software(
                name=name,
                homepage=homepage,
                download=download,
                description=description,
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
            for field, weight in weights:
                value = getattr(item, field).lower()
                if value == term:
                    best = max(best, int(weight * 1.5))
                elif term in value:
                    best = max(best, weight)
            score += best
        if score:
            ranked.append((score, item))
    ranked.sort(key=lambda pair: -pair[0])
    return [item for _, item in ranked]
