"""FastAPI 入口：路由 + CORS + SSE 流式接口。"""

import json
from typing import Iterator

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

import session as session_store
from llm import stream_chat
from pdf_parser import extract_text_from_pdf
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
