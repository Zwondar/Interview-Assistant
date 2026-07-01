"""会话状态管理：按 session_id 在内存中保存简历文本、历史对话、已问问题列表。"""

import uuid
from threading import Lock

_lock = Lock()
_sessions: dict[str, dict] = {}


def create_session() -> str:
    sid = uuid.uuid4().hex
    with _lock:
        _sessions[sid] = {
            "resume_text": "",      # 解析后的简历全文
            "history": [],          # 对话历史 [{role, content}, ...]
            "asked_questions": [],  # 已提问的问题文本列表（用于防重复）
        }
    return sid


def get_session(sid: str) -> dict | None:
    with _lock:
        return _sessions.get(sid)


def require_session(sid: str) -> dict:
    s = get_session(sid)
    if s is None:
        raise KeyError(f"session not found: {sid}")
    return s


def set_resume(sid: str, text: str) -> None:
    with _lock:
        if sid in _sessions:
            _sessions[sid]["resume_text"] = text


def append_history(sid: str, role: str, content: str) -> None:
    with _lock:
        if sid in _sessions:
            _sessions[sid]["history"].append({"role": role, "content": content})


def add_asked_question(sid: str, question: str) -> None:
    with _lock:
        if sid in _sessions:
            _sessions[sid]["asked_questions"].append(question)


def session_count() -> int:
    with _lock:
        return len(_sessions)


def snapshot(sid: str) -> dict:
    """返回会话的浅拷贝快照，供请求处理期间安全使用。"""
    with _lock:
        s = _sessions.get(sid)
        if s is None:
            return None
        return {
            "resume_text": s["resume_text"],
            "history": list(s["history"]),
            "asked_questions": list(s["asked_questions"]),
        }
