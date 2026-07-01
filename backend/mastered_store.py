"""已掌握题目持久化管理：JSON 去重 + Markdown 标准答案汇总。"""

import json
import os
from datetime import datetime
from threading import Lock

_lock = Lock()

# 数据文件路径（相对于 backend/ 目录）
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
JSON_PATH = os.path.join(DATA_DIR, "mastered_questions.json")
MD_PATH = os.path.join(DATA_DIR, "mastered_answers.md")


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def load_mastered() -> dict:
    """读取 mastered_questions.json，返回 {role: [question_text, ...]}。"""
    _ensure_data_dir()
    if not os.path.exists(JSON_PATH):
        return {}
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except (json.JSONDecodeError, Exception):
        pass
    return {}


def _save_mastered(data: dict) -> None:
    """写入 mastered_questions.json。"""
    _ensure_data_dir()
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_mastered_for_role(role: str) -> list[str]:
    """获取某角色已掌握的题目文本列表。"""
    with _lock:
        data = load_mastered()
        return data.get(role, [])


def add_mastered(role: str, question: str, standard_answer: str) -> None:
    """将一道题加入已掌握列表，同时追加到 Markdown 文档。

    - JSON：按角色存储题目文本
    - Markdown：按角色分组，追加标准答案
    """
    with _lock:
        # --- JSON ---
        data = load_mastered()
        if role not in data:
            data[role] = []
        if question not in data[role]:
            data[role].append(question)
        _save_mastered(data)

        # --- Markdown ---
        _ensure_data_dir()
        # 判断是否需要写头部
        need_header = not os.path.exists(MD_PATH) or os.path.getsize(MD_PATH) == 0

        with open(MD_PATH, "a", encoding="utf-8") as f:
            if need_header:
                f.write("# 面试题标准答案汇总\n\n")
                f.write(f"> 最后更新：{datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
                f.write("---\n\n")

            f.write(f"## {role}\n\n")
            f.write(f"### Q: {question}\n\n")
            f.write(standard_answer)
            f.write("\n\n---\n\n")


def get_review_markdown() -> str:
    """读取整个 mastered_answers.md 的内容。"""
    _ensure_data_dir()
    if not os.path.exists(MD_PATH):
        return "# 暂无已掌握的面试题\n\n还没有完成任何题目的学习，去练习吧！"
    with open(MD_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    return content if content.strip() else "# 暂无已掌握的面试题\n\n还没有完成任何题目的学习，去练习吧！"
