import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LoadingDots from './LoadingDots'

/**
 * 右上：问题 / 回答 / 分析 的流式展示区
 * props:
 *   messages: [{id, role: 'question'|'answer'|'analysis', content, streaming}]
 *   loading: null | 'asking' | 'analyzing'
 */
export default function ChatPanel({ messages, loading }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  return (
    <div className="chat-panel">
      <div className="chat-header">面试进行中</div>
      <div className="chat-body">
        {messages.length === 0 && loading !== 'asking' && (
          <div className="chat-empty">
            <p>👋 上传简历后，点击「开始面试」启动 AI 面试官</p>
            <p className="hint">问题与评分分析会在此处流式显示</p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {loading === 'asking' && (
          <div className="bubble question-bubble streaming-bubble">
            <LoadingDots label="面试官正在思考问题…" />
          </div>
        )}
        {loading === 'analyzing' && (
          <div className="bubble analysis-bubble streaming-bubble">
            <LoadingDots label="正在分析评分…" />
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function MessageBubble({ message }) {
  const cls = `${message.role}-bubble`
  const label =
    message.role === 'question'
      ? '面试官提问'
      : message.role === 'answer'
      ? '你的回答'
      : '评分分析'

  return (
    <div className={`bubble ${cls}`}>
      <div className="bubble-label">{label}</div>
      {message.role === 'answer' ? (
        <div className="bubble-content text">{message.content}</div>
      ) : (
        <div className="bubble-content markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          {message.streaming && <span className="cursor">▋</span>}
        </div>
      )}
    </div>
  )
}
