"""FastAPI 入口：路由 + CORS + SSE 流式接口。"""

import json
from typing import Iterator

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

import session as session_store
import practice_store
import mastered_store
from llm import stream_chat
from pdf_parser import extract_text_from_pdf
from practice_prompts import (
    PRACTICE_CHAT_SYSTEM,
    PRACTICE_QUESTIONS_SYSTEM,
    MASTER_ANSWER_SYSTEM,
    build_practice_chat_prompt,
    build_practice_questions_prompt,
    build_master_answer_prompt,
)
from prompts import (
    ANALYZER_SYSTEM,
    INTERVIEWER_SYSTEM,
    build_analyzer_user_prompt,
    build_interviewer_user_prompt,
)

app = FastAPI(title="面试助手 Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- 数据模型 ----------
class AskRequest(BaseModel):
    session_id: str


class AnswerRequest(BaseModel):
    session_id: str
    answer: str


class PracticeStartRequest(BaseModel):
    role: str


class PracticeChatRequest(BaseModel):
    session_id: str
    question_index: int
    message: str


class PracticeMasterRequest(BaseModel):
    session_id: str
    question_index: int


# ---------- 工具函数 ----------
def _sse(data: str) -> str:
    """格式化一条 SSE 事件。"""
    return f"data: {data}\n\n"


def _json_chunk(text: str) -> str:
    """把一段文本包成 JSON 字符串，便于前端解析（处理换行/引号）。"""
    return _sse(json.dumps({"content": text}, ensure_ascii=False))


# ---------- 接口 ----------
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_resume(file: UploadFile = File(...)):
    """上传 PDF 简历，解析文本并创建会话。"""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持 PDF 文件")
    raw = await file.read()
    try:
        resume_text, pages = extract_text_from_pdf(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF 解析失败: {e}")
    if not resume_text:
        raise HTTPException(status_code=400, detail="未能从 PDF 提取到文本，请确认非扫描件")

    sid = session_store.create_session()
    session_store.set_resume(sid, resume_text)
    print(f"[upload] 创建会话 sid={sid}, 当前会话数={session_store.session_count()}")

    # 返回给前端的简历文本截断，避免过长
    preview = resume_text if len(resume_text) <= 4000 else resume_text[:4000] + "\n...(已截断)"
    return {"session_id": sid, "resume_text": preview, "pages": pages}


def _ask_generator(sid: str) -> Iterator[str]:
    snap = session_store.snapshot(sid)
    if snap is None:
        yield _sse(json.dumps({"error": "session not found"}, ensure_ascii=False))
        yield _sse("[DONE]")
        return

    messages = [
        {"role": "system", "content": INTERVIEWER_SYSTEM},
        {
            "role": "user",
            "content": build_interviewer_user_prompt(
                snap["resume_text"], snap["asked_questions"], snap["history"]
            ),
        },
    ]

    full_question = []
    try:
        for chunk in stream_chat(messages, temperature=0.8):
            full_question.append(chunk)
            yield _json_chunk(chunk)
    except Exception as e:
        yield _sse(json.dumps({"error": str(e)}, ensure_ascii=False))

    question_text = "".join(full_question).strip()
    if question_text:
        # 记录到历史与已问列表
        session_store.append_history(sid, "assistant", question_text)
        session_store.add_asked_question(sid, question_text)

    yield _sse("[DONE]")


@app.post("/api/ask")
def ask(req: AskRequest):
    """流式生成下一道面试题。"""
    print(
        f"[ask] 收到请求 sid={req.session_id}, "
        f"会话存在={session_store.get_session(req.session_id) is not None}, "
        f"当前会话数={session_store.session_count()}"
    )
    if session_store.get_session(req.session_id) is None:
        raise HTTPException(status_code=404, detail="session not found，请先上传简历")
    return StreamingResponse(
        _ask_generator(req.session_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _answer_generator(sid: str, answer: str) -> Iterator[str]:
    snap = session_store.snapshot(sid)
    if snap is None:
        yield _sse(json.dumps({"error": "session not found"}, ensure_ascii=False))
        yield _sse("[DONE]")
        return

    # 取最近一道面试官问题作为当前问题
    current_question = ""
    for m in reversed(snap["history"]):
        if m["role"] == "assistant":
            current_question = m["content"]
            break
    if not current_question:
        yield _sse(json.dumps({"error": "没有可评估的问题，请先点击开始/继续面试"}, ensure_ascii=False))
        yield _sse("[DONE]")
        return

    # 先把用户回答记入历史
    session_store.append_history(sid, "user", answer)

    messages = [
        {"role": "system", "content": ANALYZER_SYSTEM},
        {
            "role": "user",
            "content": build_analyzer_user_prompt(
                snap["resume_text"], current_question, answer
            ),
        },
    ]

    full_analysis = []
    try:
        for chunk in stream_chat(messages, temperature=0.3):
            full_analysis.append(chunk)
            yield _json_chunk(chunk)
    except Exception as e:
        yield _sse(json.dumps({"error": str(e)}, ensure_ascii=False))

    analysis_text = "".join(full_analysis).strip()
    if analysis_text:
        session_store.append_history(sid, "assistant", analysis_text)

    yield _sse("[DONE]")


@app.post("/api/answer")
def answer(req: AnswerRequest):
    """流式返回对用户回答的评分分析。"""
    if session_store.get_session(req.session_id) is None:
        raise HTTPException(status_code=404, detail="session not found，请先上传简历")
    return StreamingResponse(
        _answer_generator(req.session_id, req.answer),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ========== 练习模式接口 ==========

@app.post("/api/practice/start")
def practice_start(req: PracticeStartRequest):
    """创建练习会话，返回 session_id + 3 道面试题。"""
    role = req.role.strip()
    if not role:
        raise HTTPException(status_code=400, detail="请填写面试角色")

    # 读取该角色已掌握的题目，注入 prompt 防重复
    mastered = mastered_store.get_mastered_for_role(role)

    messages = [
        {"role": "system", "content": PRACTICE_QUESTIONS_SYSTEM},
        {"role": "user", "content": build_practice_questions_prompt(role, mastered)},
    ]

    full_response = []
    try:
        for chunk in stream_chat(messages, temperature=0.8):
            full_response.append(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成题目失败: {e}")

    raw = "".join(full_response).strip()

    # 解析 JSON 响应
    try:
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0]
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0]
        parsed = json.loads(raw)
        questions = parsed.get("questions", [])
    except (json.JSONDecodeError, IndexError):
        # fallback: 按换行拆题
        questions = [q.strip("- ").strip() for q in raw.split("\n") if q.strip()]

    if len(questions) < 3:
        while len(questions) < 3:
            questions.append("请重新生成题目")
    questions = questions[:3]

    # 创建会话
    sid = practice_store.create_session(role)
    practice_store.set_questions(sid, questions)
    print(f"[practice/start] role={role}, sid={sid}, questions={len(questions)}")

    return {"session_id": sid, "questions": questions}


def _practice_chat_generator(sid: str, question_index: int, message: str) -> Iterator[str]:
    snap = practice_store.snapshot(sid)
    if snap is None:
        yield _sse(json.dumps({"error": "session not found"}, ensure_ascii=False))
        yield _sse("[DONE]")
        return

    if question_index < 0 or question_index >= len(snap["questions"]):
        yield _sse(json.dumps({"error": "无效的题目编号"}, ensure_ascii=False))
        yield _sse("[DONE]")
        return

    # 设置当前活跃题目
    practice_store.set_active_index(sid, question_index)

    # 记录用户消息
    practice_store.append_history(sid, "user", message)

    question = snap["questions"][question_index]
    messages = [
        {"role": "system", "content": PRACTICE_CHAT_SYSTEM},
        {"role": "user", "content": build_practice_chat_prompt(snap["role"], question, snap["history"])},
    ]

    full_reply = []
    try:
        for chunk in stream_chat(messages, temperature=0.7):
            full_reply.append(chunk)
            yield _json_chunk(chunk)
    except Exception as e:
        yield _sse(json.dumps({"error": str(e)}, ensure_ascii=False))

    reply_text = "".join(full_reply).strip()
    if reply_text:
        practice_store.append_history(sid, "assistant", reply_text)

    yield _sse("[DONE]")


@app.post("/api/practice/chat")
def practice_chat(req: PracticeChatRequest):
    """流式 SSE：用户对某题追问，模型辅导回复。"""
    if practice_store.get_session(req.session_id) is None:
        raise HTTPException(status_code=404, detail="session not found，请先开始练习")
    return StreamingResponse(
        _practice_chat_generator(req.session_id, req.question_index, req.message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/practice/master")
def practice_master(req: PracticeMasterRequest):
    """标记一道题为已掌握，生成标准答案并写入文件。"""
    snap = practice_store.snapshot(req.session_id)
    if snap is None:
        raise HTTPException(status_code=404, detail="session not found")
    if req.question_index < 0 or req.question_index >= len(snap["questions"]):
        raise HTTPException(status_code=400, detail="无效的题目编号")

    question = snap["questions"][req.question_index]
    role = snap["role"]

    # 调用 LLM 生成标准答案
    messages = [
        {"role": "system", "content": MASTER_ANSWER_SYSTEM},
        {"role": "user", "content": build_master_answer_prompt(role, question, snap["history"])},
    ]

    full_answer = []
    try:
        for chunk in stream_chat(messages, temperature=0.3):
            full_answer.append(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成标准答案失败: {e}")

    standard_answer = "".join(full_answer).strip()

    # 持久化
    mastered_store.add_mastered(role, question, standard_answer)
    print(f"[practice/master] role={role}, mastered question saved")

    return {"standard_answer": standard_answer}


@app.get("/api/practice/review")
def practice_review():
    """返回累计标准答案 Markdown 全文。"""
    content = mastered_store.get_review_markdown()
    return {"content": content}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
