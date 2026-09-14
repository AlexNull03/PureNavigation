"""DeepSeek 客户端。Key 只从服务端环境变量读取，绝不下发到浏览器。"""

from __future__ import annotations

import os
from functools import cache

import httpx
from dotenv import load_dotenv

DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"
REQUEST_TIMEOUT = 60.0
MAX_OUTPUT_TOKENS = 1200


class LlmNotConfigured(RuntimeError):
    """未配置 DEEPSEEK_API_KEY。"""


class LlmError(RuntimeError):
    """上游返回异常。"""


@cache
def _load_env() -> None:
    load_dotenv(override=False)


def _env(name: str, fallback: str) -> str:
    _load_env()
    value = os.environ.get(name, "")
    return value if value else fallback


def api_key() -> str:
    return _env("DEEPSEEK_API_KEY", "")


def is_configured() -> bool:
    return bool(api_key())


def chat(messages: list[dict[str, str]]) -> str:
    key = api_key()
    if not key:
        raise LlmNotConfigured(
            "尚未配置 DEEPSEEK_API_KEY。请在项目根目录的 .env 里填入 Key 后重启服务。"
        )

    url = f"{_env('DEEPSEEK_BASE_URL', DEFAULT_BASE_URL).rstrip('/')}/chat/completions"
    payload = {
        "model": _env("DEEPSEEK_MODEL", DEFAULT_MODEL),
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "stream": False,
    }
    try:
        response = httpx.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            timeout=REQUEST_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        raise LlmError(f"无法连接 DeepSeek：{exc}") from exc

    if response.status_code != 200:
        raise LlmError(f"DeepSeek 返回 {response.status_code}：{response.text[:300]}")

    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise LlmError("DeepSeek 返回中没有 choices 字段")
    content = (choices[0].get("message") or {}).get("content", "")
    if not content:
        raise LlmError("DeepSeek 返回了空内容")
    if choices[0].get("finish_reason") == "length":
        # 不标出来的话，用户会以为建议本来就这么短。
        content += "\n\n（这条回答被长度上限截断了，接着追问可以续上。）"
    return content.strip()
