// 后端 API 调用封装，含 SSE 流式读取

const BASE = '/api'

/**
 * 上传 PDF 简历
 * @returns {Promise<{session_id, resume_text, pages}>}
 */
export async function uploadResume(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '上传失败')
  }
  return res.json()
}

/**
 * 流式 POST：逐块读取 SSE，调用 onChunk(text) 推送文本片段。
 * 遇到 {error} 会抛出。
 */
async function streamPost(url, body, onChunk) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '请求失败')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const line = rawEvent.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      const data = line.slice(6)
      if (data === '[DONE]') return
      try {
        const obj = JSON.parse(data)
        if (obj.error) throw new Error(obj.error)
        if (obj.content) onChunk(obj.content)
      } catch (e) {
        if (e.message && !e.message.startsWith('Unexpected')) throw e
        onChunk(data)
      }
    }
  }
}

export function streamAsk(sessionId, onChunk) {
  return streamPost(`${BASE}/ask`, { session_id: sessionId }, onChunk)
}

export function streamAnswer(sessionId, answer, onChunk) {
  return streamPost(`${BASE}/answer`, { session_id: sessionId, answer }, onChunk)
}

// ========== 练习模式 API ==========

/**
 * 开始练习：创建会话并获取 3 道题
 */
export async function startPractice(role) {
  const res = await fetch(`${BASE}/practice/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '请求失败')
  }
  return res.json()
}

/**
 * 练习对话：流式追问某道题
 */
export function streamPracticeChat(sessionId, questionIndex, message, onChunk) {
  return streamPost(
    `${BASE}/practice/chat`,
    { session_id: sessionId, question_index: questionIndex, message },
    onChunk
  )
}

/**
 * 标记题目已掌握，生成标准答案
 */
export async function masterQuestion(sessionId, questionIndex) {
  const res = await fetch(`${BASE}/practice/master`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, question_index: questionIndex }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '请求失败')
  }
  return res.json()
}

/**
 * 获取回放 Markdown 文档
 */
export async function fetchReview() {
  const res = await fetch(`${BASE}/practice/review`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || '请求失败')
  }
  return res.json()
}
