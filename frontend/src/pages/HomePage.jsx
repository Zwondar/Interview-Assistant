import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      <div className="home-hero">
        <h1 className="home-title">🎯 面试助手 Agent</h1>
        <p className="home-desc">
          AI 驱动的智能面试训练平台，支持简历面试与角色练习两种模式，助你轻松拿下心仪 Offer
        </p>
      </div>

      <div className="home-cards">
        <button className="home-card card-interview" onClick={() => navigate('/interview')}>
          <div className="card-icon">📄</div>
          <h2>简历面试模式</h2>
          <p>上传 PDF 简历，AI 面试官基于简历内容进行专业提问、实时评分与反馈，模拟真实面试场景</p>
          <span className="card-action">进入面试 →</span>
        </button>

        <button className="home-card card-practice" onClick={() => navigate('/practice')}>
          <div className="card-icon">💡</div>
          <h2>角色练习模式</h2>
          <p>无需简历，选择目标岗位角色，AI 生成针对性面试题并辅导你深入理解每道题，支持追问练习与复习回放</p>
          <span className="card-action">开始练习 →</span>
        </button>
      </div>
    </div>
  )
}
