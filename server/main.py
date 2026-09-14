"""PureNavigation 后端：软件目录，同时兼作前端构建产物的静态服务器。

部署时只需要一个进程：uvicorn 既提供 /api，也把 pnpm build 出来的 dist 直接吐出去。
"""

from __future__ import annotations

from functools import cache
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from server.catalog import catalog, search


@cache
def dist_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "dist"


app = FastAPI(title="PureNavigation", docs_url=None, redoc_url=None)


@app.get("/api/health")
def health() -> dict[str, object]:
    return {"status": "ok", "items": len(catalog())}


@app.get("/api/software")
def software(q: str = Query(default="", max_length=80)) -> dict[str, object]:
    items = list(catalog())
    if q.strip():
        items = search(tuple(items), q)
    return {"items": [item.to_dict() for item in items], "count": len(items)}


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
