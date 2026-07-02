import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * 回放弹窗：以卡片形式展示所有已掌握题目，支持全屏和删除。
 *
 * Props:
 *   items     — [{role, question, answer}, ...]  结构化题目列表
 *   content   — string  原始 Markdown（fallback 用）
 *   onClose   — () => void
 *   onDelete  — (role, question) => Promise<void>
 */
export default function ReplayModal({ items, content, onClose, onDelete }) {
  const [fullscreen, setFullscreen] = useState(false)
  const [deleting, setDeleting] = useState(null) // 正在删除的题目文本

  const handleDelete = async (role, question) => {
    if (!onDelete) return
    setDeleting(question)
    try {
      await onDelete(role, question)
    } finally {
      setDeleting(null)
    }
  }

  const isEmpty = !items || items.length === 0

  return (
    <div className={`replay-overlay ${fullscreen ? 'replay-fullscreen' : ''}`} onClick={onClose}>
      <div className="replay-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="replay-header">
          <h2>📋 已掌握面试题回顾</h2>
          <div className="replay-header-actions">
            <button
              className="replay-fullscreen-btn"
              onClick={() => setFullscreen((f) => !f)}
              title={fullscreen ? '退出全屏' : '全屏展示'}
            >
              {fullscreen ? '🔲 退出全屏' : '🔍 全屏'}
            </button>
            <button className="replay-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="replay-body">
          {isEmpty ? (
            <div className="replay-empty">
              <p>📭 暂无已掌握的面试题</p>
              <p className="hint">完成练习后点击 ✓ 标记掌握，题目和标准答案会出现在这里</p>
            </div>
          ) : (
            <div className="replay-items">
              {items.map((item, idx) => (
                <div key={`${item.role}-${idx}`} className="replay-card">
                  <div className="replay-card-header">
                    <span className="replay-card-role">{item.role}</span>
                    {onDelete && (
                      <button
                        className="replay-delete-btn"
                        onClick={() => handleDelete(item.role, item.question)}
                        disabled={deleting === item.question}
                        title="删除此题，恢复为未掌握状态"
                      >
                        {deleting === item.question ? '⏳' : '🗑 删除'}
                      </button>
                    )}
                  </div>
                  <div className="replay-card-question">
                    <strong>Q:</strong> {item.question}
                  </div>
                  {item.answer ? (
                    <div className="bubble-content markdown replay-card-answer">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.answer}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="replay-card-no-answer">
                      （标准答案尚未生成，请重新标记掌握）
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Fallback: 如果 items 为空但有 content，显示原始 markdown */}
          {isEmpty && content && (
            <div className="bubble-content markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
