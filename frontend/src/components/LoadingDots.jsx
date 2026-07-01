export default function LoadingDots({ label }) {
  return (
    <span className="loading">
      <span className="loading-dots">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </span>
      {label && <span className="loading-label">{label}</span>}
    </span>
  )
}
