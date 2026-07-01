import { useRef, useState, useCallback } from 'react'

/**
 * 语音输入按钮：使用 Web Speech API 进行语音转文字
 * props: onResult(text), disabled
 */
export default function VoiceButton({ onResult, disabled }) {
  const [listening, setListening] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const recognitionRef = useRef(null)

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  const toggleListen = useCallback(() => {
    if (!SpeechRecognition) {
      setUnsupported(true)
      setTimeout(() => setUnsupported(false), 3000)
      return
    }

    if (listening) {
      // 停止
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    // 开始
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript && onResult) {
        onResult(transcript)
      }
      setListening(false)
    }

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [listening, onResult, SpeechRecognition])

  if (!SpeechRecognition) {
    return (
      <button
        className={`voice-btn ${unsupported ? 'voice-unsupported' : ''}`}
        type="button"
        disabled={disabled}
        onClick={toggleListen}
        title="当前浏览器不支持语音输入"
      >
        🎤
      </button>
    )
  }

  return (
    <button
      className={`voice-btn ${listening ? 'voice-listening' : ''}`}
      type="button"
      disabled={disabled}
      onClick={toggleListen}
      title={listening ? '正在录音，点击停止' : '点击开始语音输入'}
    >
      {listening ? '🔴' : '🎤'}
    </button>
  )
}
