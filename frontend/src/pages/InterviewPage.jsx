import { useCallback, useRef, useState } from 'react'
import ResumePanel from '../components/ResumePanel'
import AnswerInput from '../components/AnswerInput'
import ChatPanel from '../components/ChatPanel'
import ControlBar from '../components/ControlBar'
import { streamAnswer, streamAsk, uploadResume } from '../api'

let _msgId = 0
const nextId = () => ++_msgId

export default function InterviewPage() {
  // 简历状态
  const [sessionId, setSessionId] = useState(null)
  const [resumeText, setResumeText] = useState('')
  const [pages, setPages] = useState(0)
  const [fileName, setFileName] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)

  // 对话状态
  const [messages, setMessages] = useState([])
  // loading: null | 'asking' | 'analyzing'
  const [loading, setLoading] = useState(null)
  const [answer, setAnswer] = useState('')
  const [hasStarted, setHasStarted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const lastQuestionIdRef = useRef(null)

  const canStart = !!sessionId && !uploading
  // 输入框可用：已有问题且当前不在 asking/analyzing
  const inputDisabled = loading !== null || lastQuestionIdRef.current === null

  const showError = (msg) => {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(''), 5000)
  }

  // ---------- 上传 ----------
  const handleUpload = useCallback(async (file) => {
    setUploading(true)
    setErrorMsg('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setFileName(file.name)
    try {
      const data = await uploadResume(file)
      setSessionId(data.session_id)
      setResumeText(data.resume_text)
      setPages(data.pages)
    } catch (e) {
      showError(e.message)
      setPreviewUrl(null)
      setFileName('')
    } finally {
      setUploading(false)
    }
  }, [previewUrl])

  // ---------- 提问 ----------
  const handleAsk = useCallback(async () => {
    if (!sessionId) return
    setLoading('asking')
    setErrorMsg('')
    const msgId = nextId()
    lastQuestionIdRef.current = msgId
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: 'question', content: '', streaming: true },
    ])
    try {
      await streamAsk(sessionId, (chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, content: m.content + chunk } : m
          )
        )
      })
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, streaming: false } : m))
      )
      setHasStarted(true)
    } catch (e) {
      showError(e.message)
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
      lastQuestionIdRef.current = null
    } finally {
      setLoading(null)
    }
  }, [sessionId])

  // ---------- 回答 ----------
  const handleSend = useCallback(async () => {
    const text = answer.trim()
    if (!text || !sessionId || loading) return
    const ansId = nextId()
    setMessages((prev) => [
      ...prev,
      { id: ansId, role: 'answer', content: text, streaming: false },
    ])
    setAnswer('')

    setLoading('analyzing')
    setErrorMsg('')
    const analysisId = nextId()
    setMessages((prev) => [
      ...prev,
      { id: analysisId, role: 'analysis', content: '', streaming: true },
    ])
    try {
      await streamAnswer(sessionId, text, (chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === analysisId ? { ...m, content: m.content + chunk } : m
          )
        )
      })
      setMessages((prev) =>
        prev.map((m) => (m.id === analysisId ? { ...m, streaming: false } : m))
      )
      lastQuestionIdRef.current = null
    } catch (e) {
      showError(e.message)
      setMessages((prev) => prev.filter((m) => m.id !== analysisId))
    } finally {
      setLoading(null)
    }
  }, [answer, sessionId, loading])

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎯 面试助手 Agent</h1>
        <span className="subtitle">基于简历的 AI 模拟面试 · 流式问答</span>
      </header>

      {errorMsg && <div className="error-bar">{errorMsg}</div>}

      <main className="layout">
        {/* 左侧 */}
        <section className="left-col">
          <ResumePanel
            resumeText={resumeText}
            pages={pages}
            fileName={fileName}
            uploading={uploading}
            onUpload={handleUpload}
            previewUrl={previewUrl}
          />
          <AnswerInput
            value={answer}
            onChange={setAnswer}
            onSend={handleSend}
            disabled={inputDisabled}
            disabledHint={
              loading === 'analyzing'
                ? '正在分析评分，请稍候…'
                : loading === 'asking'
                ? '面试官正在提问…'
                : '点击「开始/继续面试」获取问题后再作答'
            }
          />
        </section>

        {/* 右侧 */}
        <section className="right-col">
          <ControlBar
            canStart={canStart}
            hasStarted={hasStarted}
            loading={loading}
            onAsk={handleAsk}
          />
          <ChatPanel messages={messages} loading={loading} />
        </section>
      </main>
    </div>
  )
}
