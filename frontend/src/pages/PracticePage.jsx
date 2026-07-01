import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LoadingDots from '../components/LoadingDots'
import AnswerInput from '../components/AnswerInput'
import QuestionCard from '../components/QuestionCard'
import ReplayModal from '../components/ReplayModal'
import { startPractice, streamPracticeChat, masterQuestion, fetchReview } from '../api'

let _msgId = 0
const nextId = () => ++_msgId

export default function PracticePage() {
  // 角色 & 会话
  const [role, setRole] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [questions, setQuestions] = useState([])
  const [mastered, setMastered] = useState([false, false, false])

  // 当前讨论的题目
  const [activeIndex, setActiveIndex] = useState(null)
  const [messages, setMessages] = useState([])

  // 输入
  const [inputValue, setInputValue] = useState('')

  // loading: null | 'generating' | 'chatting'
  const [loading, setLoading] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [hasStarted, setHasStarted] = useState(false)

  // 回放
  const [showReview, setShowReview] = useState(false)
  const [reviewContent, setReviewContent] = useState('')

  const chatEndRef = useRef(null)

  const inputDisabled = loading !== null || activeIndex === null

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const showError = (msg) => {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(''), 5000)
  }

  // ---------- 开始面试 ----------
  const handleStart = async () => {
    const trimmedRole = role.trim()
    if (!trimmedRole) {
      showError('请填写面试角色')
      return
    }
    setLoading('generating')
    setErrorMsg('')
    setActiveIndex(null)
    setMessages([])
    setMastered([false, false, false])
    setHasStarted(true)

    try {
      const data = await startPractice(trimmedRole)
      setSessionId(data.session_id)
      setQuestions(data.questions)
    } catch (e) {
      showError(e.message)
    } finally {
      setLoading(null)
    }
  }

  // ---------- 点击题目 ----------
  const handleSelectQuestion = (index) => {
    if (mastered[index]) return // 已掌握的题不允许再对话
    setActiveIndex(index)
    setMessages([])
  }

  // ---------- 发送追问 ----------
  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || !sessionId || loading || activeIndex === null) return

    const userMsgId = nextId()
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: text, streaming: false },
    ])
    setInputValue('')

    setLoading('chatting')
    setErrorMsg('')
    const assistantMsgId = nextId()
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: 'assistant', content: '', streaming: true },
    ])

    try {
      await streamPracticeChat(sessionId, activeIndex, text, (chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m
          )
        )
      })
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, streaming: false } : m))
      )
    } catch (e) {
      showError(e.message)
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId))
    } finally {
      setLoading(null)
    }
  }

  // ---------- 标记已掌握 ----------
  const handleMaster = async (index) => {
    if (!sessionId || mastered[index]) return
    setErrorMsg('')

    try {
      await masterQuestion(sessionId, index)
      setMastered((prev) => {
        const next = [...prev]
        next[index] = true
        return next
      })
      // 如果当前正在讨论这道题，关闭对话区
      if (activeIndex === index) {
        setActiveIndex(null)
        setMessages([])
      }
    } catch (e) {
      showError(e.message)
    }
  }

  // ---------- 回放 ----------
  const handleReplay = async () => {
    setErrorMsg('')
    try {
      const data = await fetchReview()
      setReviewContent(data.content)
      setShowReview(true)
    } catch (e) {
      showError(e.message)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>💡 角色练习模式</h1>
        <span className="subtitle">选择目标岗位，AI 生成面试题并辅导你深入理解</span>
      </header>

      {errorMsg && <div className="error-bar">{errorMsg}</div>}

      <main className="practice-layout">
        {/* 顶部：角色输入 + 开始按钮 */}
        <section className="practice-top-bar">
          <div className="role-input-wrap">
            <label className="role-label">目标岗位</label>
            <input
              className="role-input"
              type="text"
              placeholder="例如：后端工程师、Agent 开发工程师、前端架构师…"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && role.trim()) handleStart()
              }}
              disabled={loading === 'generating'}
            />
          </div>
          <button
            className="practice-start-btn"
            onClick={handleStart}
            disabled={loading === 'generating' || !role.trim()}
          >
            {loading === 'generating' ? <LoadingDots label="生成题目中…" /> : '开始面试'}
          </button>
          <button className="replay-btn" onClick={handleReplay} title="查看已掌握题目总结">
            📋 回放
          </button>
        </section>

        {/* 中部：3 张题卡 */}
        {hasStarted && questions.length > 0 && (
          <section className="practice-questions">
            <h3 className="section-title">面试题目（点击选择一题开始讨论）</h3>
            <div className="questions-grid">
              {questions.map((q, i) => (
                <QuestionCard
                  key={i}
                  index={i}
                  question={q}
                  active={activeIndex === i}
                  mastered={mastered[i]}
                  onSelect={() => handleSelectQuestion(i)}
                  onMaster={() => handleMaster(i)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 底部：对话区（选中某题后展示） */}
        {activeIndex !== null && (
          <section className="practice-chat-section">
            <div className="practice-chat-header">
              <span>📌 正在讨论：{questions[activeIndex]?.slice(0, 50)}…</span>
              <button
                className="close-chat-btn"
                onClick={() => { setActiveIndex(null); setMessages([]) }}
              >
                ✕ 关闭
              </button>
            </div>

            <div className="practice-chat-body">
              {messages.length === 0 && loading !== 'chatting' && (
                <div className="chat-empty">
                  <p>💬 针对这道题提出你的疑问</p>
                  <p className="hint">AI 辅导官会从原理层面帮你深入理解</p>
                </div>
              )}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`practice-bubble ${m.role === 'user' ? 'practice-user-bubble' : 'practice-ai-bubble'}`}
                >
                  <div className="bubble-label">
                    {m.role === 'user' ? '你' : 'AI 辅导官'}
                  </div>
                  <div className="bubble-content markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    {m.streaming && <span className="cursor">▋</span>}
                  </div>
                </div>
              ))}

              {loading === 'chatting' && messages.length === 0 && (
                <div className="practice-bubble practice-ai-bubble">
                  <LoadingDots label="AI 辅导官正在回复…" />
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <div className="practice-chat-input">
              <AnswerInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSend}
                disabled={inputDisabled}
                disabledHint={
                  loading === 'chatting'
                    ? 'AI 正在回复…'
                    : '请先选择一道题目开始讨论'
                }
              />
            </div>
          </section>
        )}

        {/* 生成题目中 */}
        {loading === 'generating' && (
          <div className="generating-hint">
            <LoadingDots label="正在根据岗位角色生成 3 道高质量面试题…" />
          </div>
        )}
      </main>

      {/* 回放弹窗 */}
      {showReview && (
        <ReplayModal content={reviewContent} onClose={() => setShowReview(false)} />
      )}
    </div>
  )
}
