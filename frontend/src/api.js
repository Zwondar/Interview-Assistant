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
 * @param {string} url
 * @param {object} body
 * @param {(text: string) => void} onChunk
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

    // 按空行分割 SSE 事件
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
        // 非 JSON（如直接文本），原样输出
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
