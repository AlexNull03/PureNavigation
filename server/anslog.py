"""把「AI 协助安装」的问答按时间戳落盘到 ans/。

文件名就是时间戳（2026-09-28_21-30-12.md），一次请求一个文件，内容包含完整对话
和这轮回复命中的已登记工具。写盘失败绝不影响对话本身 —— 记录是副产品，
不能反过来把主功能拖死，所以这里只捕获异常并打警告。

注意：ans/ 已在 .gitignore 里。仓库是公开的，访客提问不该被顺手推到 GitHub 上；
要归档的话由站长自己决定。
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

ANS_DIR = Path(__file__).resolve().parent.parent / "ans"


def record(messages: list[dict[str, str]], reply: str, recommended: list[str]) -> Path | None:
    """写入一条问答记录，返回文件路径；失败返回 None。"""
    stamp = datetime.now()
    ANS_DIR.mkdir(parents=True, exist_ok=True)

    stem = stamp.strftime("%Y-%m-%d_%H-%M-%S")
    path = ANS_DIR / f"{stem}.md"
    seq = 1
    while path.exists():  # 同一秒两次请求：加序号而不是覆盖
        path = ANS_DIR / f"{stem}-{seq}.md"
        seq += 1

    lines = [
        "# AI 协助安装记录",
        "",
        f"- 时间：{stamp.strftime('%Y-%m-%d %H:%M:%S')}",
    ]
    if recommended:
        lines.append(f"- 回复命中的已登记工具：{'、'.join(recommended)}")
    lines += ["", "## 对话", ""]
    for message in messages:
        role = "用户" if message.get("role") == "user" else "AI"
        lines.append(f"**{role}**：")
        lines.append("")
        lines.append(str(message.get("content", "")).strip())
        lines.append("")
    if lines and not lines[-1]:
        lines.pop()

    try:
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except OSError as exc:
        print(f"[ans] 记录写入失败：{exc}", file=sys.stderr)
        return None
    return path
