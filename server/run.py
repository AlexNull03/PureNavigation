"""进程入口：从环境（或 .env）取 HOST / PORT 起服务。

systemd 的 ExecStart 不做 shell 的 `${VAR:-默认}` 展开，缺变量时会直接传成空参数，
所以默认值只能写在这里，不能写在 unit 文件里。
"""

from __future__ import annotations

import os

import uvicorn
from dotenv import load_dotenv


def main() -> None:
    load_dotenv(override=False)
    uvicorn.run(
        "server.main:app",
        host=os.environ.get("HOST") or "127.0.0.1",
        port=int(os.environ.get("PORT") or 8000),
        # 只信本机 nginx 反代传来的 X-Forwarded-For。不解析的话所有访客在
        # _throttle 眼里都是 127.0.0.1，判别功能的限流会变成全站共享 6 次/分钟。
        proxy_headers=True,
        forwarded_allow_ips="127.0.0.1",
    )


if __name__ == "__main__":
    main()
