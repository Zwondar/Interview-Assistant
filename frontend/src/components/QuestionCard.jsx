/**
 * 题卡组件：展示题目文本、选中状态、✓ 掌握按钮
 */
export default function QuestionCard({ index, question, active, mastered, onSelect, onMaster }) {
  return (
    <div className={`question-card ${active ? 'active' : ''} ${mastered ? 'mastered' : ''}`}>
      <div className="question-card-header">
        <span className="question-card-num">第 {index + 1} 题</span>
        {mastered && <span className="mastered-badge">✅ 已掌握</span>}
      </div>
      <p className="question-card-text">{question}</p>
      <div className="question-card-actions">
        {!mastered && (
          <>
            <button className="q-btn q-btn-discuss" onClick={onSelect}>
              {active ? '💬 讨论中…' : '开始讨论'}
            </button>
            <button
              className="q-btn q-btn-master"
              onClick={(e) => { e.stopPropagation(); onMaster() }}
              title="我已完全理解这道题"
            >
              ✓ 掌握
            </button>
          </>
        )}
        {mastered && (
          <span className="mastered-text">已掌握，不会再次出现</span>
        )}
      </div>
    </div>
  )
}
