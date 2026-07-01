"""DeepSeek 大模型流式调用封装（OpenAI 兼容接口）。"""

import os
from typing import Iterator

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-pro")

_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        if not _API_KEY:
            raise RuntimeError(
                "未配置 DEEPSEEK_API_KEY，请在 backend/.env 中设置（参考 .env.example）"
            )
        _client = OpenAI(api_key=_API_KEY, base_url=_BASE_URL)
    return _client


def stream_chat(messages: list[dict], temperature: float = 0.7) -> Iterator[str]:
    """以生成器形式逐块返回模型输出文本。

    messages: OpenAI 消息格式 [{role, content}, ...]
    yield: 每个 delta 的文本片段
    """
    client = get_client()
    stream = client.chat.completions.create(
        model=_MODEL,
        messages=messages,
        stream=True,
        temperature=temperature,
    )
    for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        content = getattr(delta, "content", None)
        if content:
            yield content
