import LoadingDots from './LoadingDots'

/**
 * 控制按钮栏：开始面试 / 继续面试
 * props:
 *   canStart, hasStarted, loading, onAsk
 */
export default function ControlBar({ canStart, hasStarted, loading, onAsk }) {
  const busy = loading === 'asking' || loading === 'analyzing'
  const label = hasStarted ? '继续面试' : '开始面试'

  return (
    <div className="control-bar">
      <button
        className="control-btn"
        onClick={onAsk}
        disabled={!canStart || busy}
        title={!canStart ? '请先上传简历' : ''}
      >
        {busy && loading === 'asking' ? <LoadingDots /> : label}
      </button>
      <span className="control-hint">
        {hasStarted
          ? '回答完一题并查看评分后，点此获取下一题'
          : '上传简历后点击开始，AI 面试官将基于简历提问'}
      </span>
    </div>
  )
}
