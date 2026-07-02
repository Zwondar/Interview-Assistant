"""DeepSeek 大模型流式调用封装（OpenAI 兼容接口）。"""

import json
import os
import traceback
from datetime import datetime, timezone, timedelta
from typing import Iterator

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-pro")

_client: OpenAI | None = None

# 日志目录
_LOG_DIR = os.path.join(os.path.dirname(__file__), "data", "llm_logs")
os.makedirs(_LOG_DIR, exist_ok=True)

# 北京时间时区
_TZ_BEIJING = timezone(timedelta(hours=8))


def _beijing_now() -> str:
    """返回北京时间 ISO 格式字符串。"""
    return datetime.now(_TZ_BEIJING).isoformat(timespec="seconds")


def _log_id() -> str:
    """生成唯一的日志 ID。"""
    return datetime.now(_TZ_BEIJING).strftime("%Y%m%d_%H%M%S_%f")


def get_client() -> OpenAI:
    global _client
    if _client is None:
        if not _API_KEY:
            raise RuntimeError(
                "未配置 DEEPSEEK_API_KEY，请在 backend/.env 中设置（参考 .env.example）"
            )
        _client = OpenAI(api_key=_API_KEY, base_url=_BASE_URL)
    return _client


def stream_chat(
    messages: list[dict],
    temperature: float = 0.7,
    label: str = "unknown",
) -> Iterator[str]:
    """以生成器形式逐块返回模型输出文本，同时完整记录请求/响应日志到 JSON 文件。

    messages: OpenAI 消息格式 [{role, content}, ...]
    temperature: 模型温度
    label: 调用场景标识（如 interview_ask / practice_chat / ...）
    yield: 每个 delta 的文本片段
    """
    rid = _log_id()
    log_path = os.path.join(_LOG_DIR, f"{rid}.json")

    # ---- 先落盘：请求快照 ----
    log_entry = {
        "id": rid,
        "label": label,
        "timestamp": _beijing_now(),
        "model": _MODEL,
        "temperature": temperature,
        "messages": messages,
        "response": None,
        "error": None,
        "response_timestamp": None,
    }
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(log_entry, f, ensure_ascii=False, indent=2)

    full_response: list[str] = []
    try:
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
                full_response.append(content)
                yield content
    except Exception as e:
        log_entry["error"] = f"{type(e).__name__}: {e}\n\n{traceback.format_exc()}"
        raise
    finally:
        # ---- 更新日志：写入完整响应 ----
        log_entry["response"] = "".join(full_response)
        log_entry["response_timestamp"] = _beijing_now()
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(log_entry, f, ensure_ascii=False, indent=2)
