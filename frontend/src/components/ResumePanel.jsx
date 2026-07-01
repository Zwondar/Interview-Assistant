import { useRef, useState } from 'react'
import LoadingDots from './LoadingDots'

/**
 * 左上：上传简历按钮 + PDF 预览
 * props:
 *   resumeText, pages, fileName, uploading, onUpload(file), onPreviewUrl
 */
export default function ResumePanel({ resumeText, pages, fileName, uploading, onUpload, previewUrl }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file) => {
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      onUpload(file)
    } else {
      alert('请上传 PDF 文件')
    }
  }

  return (
    <div className="resume-panel">
      <div className="resume-top">
        <button
          className="upload-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '解析中…' : '上传简历（PDF）'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <div
        className={`resume-preview ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
      >
        {uploading ? (
          <LoadingDots label="正在解析简历…" />
        ) : previewUrl ? (
          <iframe title="简历预览" src={previewUrl} className="pdf-iframe" />
        ) : resumeText ? (
          <>
            <div className="resume-meta">
              {fileName} · {pages} 页
            </div>
            <pre className="resume-text">{resumeText}</pre>
          </>
        ) : (
          <div className="resume-empty">
            <p>📎 拖拽 PDF 到此处，或点击上方按钮上传</p>
            <p className="hint">上传后即可开始模拟面试</p>
          </div>
        )}
      </div>
    </div>
  )
}
