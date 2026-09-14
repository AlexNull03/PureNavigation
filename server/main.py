"""PureNavigation 后端：软件目录 + AI 建议 + 网站真伪判别。

同时兼作前端构建产物的静态服务器，部署时只需要一个进程。
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from functools import cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from server import llm
from server.catalog import catalog, search
from server.netguard import TargetError
from server.prompts import advise_system, inspect_system, refuse_notice
from server.scan import scan

MAX_TURNS = 12
MAX_CONTENT = 2000
SCAN_BUDGET = 6
SCAN_WINDOW_SECONDS = 60
TRACKED_IP_LIMIT = 4000


class ChatMessage(BaseModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str = Field(min_length=1, max_length=MAX_CONTENT)


class AdviseRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_TURNS)


class InspectRequest(BaseModel):
    url: str = Field(min_length=4, max_length=300)
    question: str = Field(default="", max_length=MAX_CONTENT)


@cache
def dist_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "dist"


_scan_hits: dict[str, deque[float]] = defaultdict(deque)


def _throttle(request: Request) -> None:
    """按 IP 的滑动窗口限流。判别会对外发起 whois/TLS 连接，不能敞开跑。"""
    if len(_scan_hits) > TRACKED_IP_LIMIT:
        _scan_hits.clear()
    now = time.monotonic()
    client = request.client.host if request.client else "unknown"
    hits = _scan_hits[client]
    while hits and now - hits[0] > SCAN_WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= SCAN_BUDGET:
        raise HTTPException(status_code=429, detail="判别请求过于频繁，请一分钟后再试")
    hits.append(now)


def _as_llm_messages(messages: list[ChatMessage]) -> list[dict[str, str]]:
    return [{"role": m.role, "content": m.content} for m in messages[-MAX_TURNS:]]


app = FastAPI(title="PureNavigation", docs_url=None, redoc_url=None)


@app.get("/api/health")
def health() -> dict[str, object]:
    return {"status": "ok", "items": len(catalog()), "llm_configured": llm.is_configured()}


@app.get("/api/software")
def software(q: str = Query(default="", max_length=80)) -> dict[str, object]:
    items = list(catalog())
    if q.strip():
        items = search(tuple(items), q)
    return {
        "items": [item.to_dict() for item in items],
        "count": len(items),
        "disclaimer": refuse_notice(),
    }


@app.post("/api/advise")
def advise(body: AdviseRequest) -> dict[str, object]:
    messages = [{"role": "system", "content": advise_system()}, *_as_llm_messages(body.messages)]
    try:
        reply = llm.chat(messages)
    except llm.LlmNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except llm.LlmError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"reply": reply, "disclaimer": refuse_notice()}


@app.post("/api/inspect")
def inspect(body: InspectRequest, request: Request) -> dict[str, object]:
    _throttle(request)
    try:
        result = scan(body.url)
    except TargetError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    evidence = result.evidence_text()
    question = body.question.strip() or "请判别这个网站是不是假冒官网或盗版分发站。"
    messages = [
        {"role": "system", "content": inspect_system(evidence)},
        {"role": "user", "content": question},
    ]
    try:
        reply = llm.chat(messages)
    except llm.LlmNotConfigured:
        # Key 没配也照样把客观证据交还给用户，功能不至于整块不可用。
        reply = "后端取证已完成，但尚未配置 DEEPSEEK_API_KEY，暂时给不出自然语言结论。\n\n" + evidence
    except llm.LlmError as exc:
        raise HTTPException(status_code=502, detail=f"{exc}\n\n取证结果：\n{evidence}") from exc
    return {"reply": reply, "evidence": result.to_dict(), "disclaimer": refuse_notice()}


def _mount_spa(target: FastAPI) -> None:
    assets = dist_dir() / "assets"
    if assets.is_dir():
        target.mount("/assets", StaticFiles(directory=assets), name="assets")
    target.mount("/", StaticFiles(directory=dist_dir(), html=True), name="spa")


if (dist_dir() / "index.html").exists():
    _mount_spa(app)
else:

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_not_built(full_path: str) -> JSONResponse:
        del full_path
        return JSONResponse(
            {"detail": "前端尚未构建：在仓库根目录执行 pnpm install && pnpm build 后再访问。"},
            status_code=503,
        )
