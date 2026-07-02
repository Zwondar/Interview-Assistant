"""已掌握题目持久化管理：JSON 存储（含答案）+ Markdown 标准答案汇总。"""

import json
import os
import re
from datetime import datetime
from threading import Lock

_lock = Lock()

# 数据文件路径（相对于 backend/ 目录）
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
JSON_PATH = os.path.join(DATA_DIR, "mastered_questions.json")
MD_PATH = os.path.join(DATA_DIR, "mastered_answers.md")

# ---- 新格式: {role: [{question, answer}, ...]}
# ---- 旧格式: {role: [question_str, ...]} → 自动迁移


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _extract_answers_from_md() -> dict[str, dict[str, str]]:
    """从现有 mastered_answers.md 中提取所有题目→答案的映射。
    返回 {role: {question_text: answer_text}}。
    """
    result: dict[str, dict[str, str]] = {}
    if not os.path.exists(MD_PATH):
        return result

    with open(MD_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 按 ## 角色名 拆分
    role_blocks = re.split(r"\n## (.+)\n", content)
    # role_blocks[0] = 标题/前言, [1]=role1, [2]=role1_content, [3]=role2, ...
    i = 1
    while i < len(role_blocks):
        role = role_blocks[i].strip()
        role_content = role_blocks[i + 1] if i + 1 < len(role_blocks) else ""
        i += 2

        if role not in result:
            result[role] = {}

        # 按 ### Q: 拆分每道题
        q_blocks = re.split(r"### Q: (.+?)\n", role_content)
        # q_blocks[0] = content before first Q, [1]=question1, [2]=answer1, [3]=question2, ...
        j = 1
        while j < len(q_blocks):
            question = q_blocks[j].strip()
            answer = ""
            if j + 1 < len(q_blocks):
                # 取到下一个 --- 或 ## 或下一个 ### Q: 之前的内容
                raw = q_blocks[j + 1]
                # 去掉末尾的 --- 分隔线
                raw = re.sub(r"\n---\s*$", "", raw)
                answer = raw.strip()
            result[role][question] = answer
            j += 2

    return result


def _migrate_data(data: dict) -> dict:
    """检测旧格式并迁移。旧格式 items 是字符串列表，新格式是对象列表。"""
    if not data:
        return data

    # 检查是否有任何 role 使用了旧格式
    needs_migration = any(
        isinstance(items, list) and items and isinstance(items[0], str)
        for items in data.values()
    )
    if not needs_migration:
        return data

    # 尝试从 MD 文件中提取已有答案
    md_answers = _extract_answers_from_md()

    migrated = {}
    for role, items in data.items():
        migrated[role] = []
        if isinstance(items, list):
            for item in items:
                if isinstance(item, str):
                    q = item
                    a = md_answers.get(role, {}).get(q, "")
                    migrated[role].append({"question": q, "answer": a})
                elif isinstance(item, dict):
                    migrated[role].append(item)
    return migrated


def load_mastered() -> dict:
    """读取 mastered_questions.json，自动迁移旧格式。"""
    _ensure_data_dir()
    if not os.path.exists(JSON_PATH):
        return {}
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            migrated = _migrate_data(data)
            # 如果发生了迁移，立即落盘新格式
            if migrated is not data:
                _save_mastered(migrated)
            return migrated
    except (json.JSONDecodeError, Exception):
        return {}


def _save_mastered(data: dict) -> None:
    """写入 mastered_questions.json。"""
    _ensure_data_dir()
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _rebuild_markdown(data: dict) -> None:
    """根据 JSON 数据完整重建 mastered_answers.md。"""
    _ensure_data_dir()

    # 收集所有条目并按角色排序
    entries: list[tuple[str, str, str]] = []  # (role, question, answer)
    for role, items in data.items():
        for item in items:
            if isinstance(item, dict):
                entries.append((role, item.get("question", ""), item.get("answer", "")))

    if not entries:
        # 清空 MD 文件
        with open(MD_PATH, "w", encoding="utf-8") as f:
            f.write("")
        return

    lines: list[str] = []
    lines.append("# 面试题标准答案汇总\n")
    lines.append(f"> 最后更新：{datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
    lines.append("---\n")

    for role, question, answer in entries:
        lines.append(f"## {role}\n")
        lines.append(f"### Q: {question}\n")
        if answer:
            lines.append(answer.strip() + "\n")
        lines.append("---\n")

    with open(MD_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def get_mastered_for_role(role: str) -> list[str]:
    """获取某角色已掌握的题目文本列表（仅问题，用于去重）。"""
    with _lock:
        data = load_mastered()
        items = data.get(role, [])
        if items and isinstance(items[0], dict):
            return [item.get("question", "") for item in items]
        return items  # 旧格式兼容（理论上不会走到这里）


def get_all_mastered() -> list[dict]:
    """获取所有已掌握题目（含答案），返回 [{role, question, answer}, ...]。"""
    with _lock:
        data = load_mastered()
        result: list[dict] = []
        for role, items in data.items():
            for item in items:
                if isinstance(item, dict):
                    result.append({
                        "role": role,
                        "question": item.get("question", ""),
                        "answer": item.get("answer", ""),
                    })
        return result


def add_mastered(role: str, question: str, standard_answer: str) -> None:
    """将一道题加入已掌握列表，同时重建 Markdown。

    - JSON：按角色存储题目+答案
    - Markdown：从 JSON 完整重建
    """
    with _lock:
        data = load_mastered()
        if role not in data:
            data[role] = []

        # 检查是否已存在（按题目文本去重）
        existing_questions = [
            item.get("question", "") if isinstance(item, dict) else item
            for item in data[role]
        ]
        if question not in existing_questions:
            data[role].append({"question": question, "answer": standard_answer})

        _save_mastered(data)
        _rebuild_markdown(data)


def remove_mastered(role: str, question: str) -> bool:
    """删除一道已掌握题目，返回是否成功。同时重建 Markdown。"""
    with _lock:
        data = load_mastered()
        if role not in data:
            return False

        before = len(data[role])
        data[role] = [
            item
            for item in data[role]
            if (item.get("question", "") if isinstance(item, dict) else item) != question
        ]
        if len(data[role]) == before:
            return False  # 没找到匹配的题目

        # 如果角色下没题目了，删除角色 key
        if not data[role]:
            del data[role]

        _save_mastered(data)
        _rebuild_markdown(data)
        return True


def get_review_markdown() -> str:
    """读取整个 mastered_answers.md 的内容。"""
    _ensure_data_dir()
    if not os.path.exists(MD_PATH) or os.path.getsize(MD_PATH) == 0:
        return "# 暂无已掌握的面试题\n\n还没有完成任何题目的学习，去练习吧！"
    with open(MD_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    return content if content.strip() else "# 暂无已掌握的面试题\n\n还没有完成任何题目的学习，去练习吧！"
