import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * 回放弹窗：渲染累计 mastered_answers.md 内容
 */
export default function ReplayModal({ content, onClose }) {
  return (
    <div className="replay-overlay" onClick={onClose}>
      <div className="replay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="replay-header">
          <h2>📋 已掌握面试题回顾</h2>
          <button className="replay-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="replay-body">
          <div className="bubble-content markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
