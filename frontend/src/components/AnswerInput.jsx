import { useEffect, useRef } from 'react'

/**
 * 左下：回答输入框 + 发送按钮
 * props:
 *   value, onChange(value), onSend(), disabled, disabledHint
 */
export default function AnswerInput({ value, onChange, onSend, disabled, disabledHint }) {
  const ref = useRef(null)

  // 自适应高度
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [value])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSend()
    }
  }

  return (
    <div className="answer-input">
      <textarea
        ref={ref}
        className="answer-textarea"
        placeholder={
          disabled
            ? disabledHint || '请先等待面试官提问…'
            : '在此输入你的回答（Enter 发送，Shift+Enter 换行）'
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={2}
      />
      <button
        className="send-btn"
        onClick={onSend}
        disabled={disabled || !value.trim()}
      >
        发送
      </button>
    </div>
  )
}
