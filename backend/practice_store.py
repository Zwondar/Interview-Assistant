"""练习模式会话管理：按 session_id 在内存中保存角色、题目、历史。"""

import uuid
from threading import Lock

_lock = Lock()
_sessions: dict[str, dict] = {}


def create_session(role: str) -> str:
    """创建练习会话，返回 session_id。"""
    sid = uuid.uuid4().hex
    with _lock:
        _sessions[sid] = {
            "role": role,
            "questions": [],       # 3 道面试题
            "active_index": None,  # 当前正在讨论的题号 (0/1/2)
            "history": [],         # 对话历史 [{role, content}, ...]
        }
    return sid


def get_session(sid: str) -> dict | None:
    with _lock:
        return _sessions.get(sid)


def set_questions(sid: str, questions: list[str]) -> None:
    """写入 3 道面试题。"""
    with _lock:
        s = _sessions.get(sid)
        if s:
            s["questions"] = questions


def set_active_index(sid: str, index: int) -> None:
    """设置当前讨论的题号。"""
    with _lock:
        s = _sessions.get(sid)
        if s:
            s["active_index"] = index


def append_history(sid: str, role: str, content: str) -> None:
    """追加一条对话记录。"""
    with _lock:
        s = _sessions.get(sid)
        if s:
            s["history"].append({"role": role, "content": content})


def session_count() -> int:
    with _lock:
        return len(_sessions)


def snapshot(sid: str) -> dict:
    """返回会话浅拷贝快照。"""
    with _lock:
        s = _sessions.get(sid)
        if s is None:
            return None
        return {
            "role": s["role"],
            "questions": list(s["questions"]),
            "active_index": s["active_index"],
            "history": list(s["history"]),
        }
