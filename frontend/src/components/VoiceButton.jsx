import { useRef, useState, useCallback } from 'react'

/**
 * 语音输入按钮：使用 Web Speech API 进行语音转文字
 * 持续监听直到用户手动停止，不会因停顿而中断
 * props: onResult(text), disabled
 */
export default function VoiceButton({ onResult, disabled }) {
  const [listening, setListening] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const accumulatedRef = useRef('')       // 累积所有识别结果
  const recognitionRef = useRef(null)

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  const toggleListen = useCallback(() => {
    if (!SpeechRecognition) {
      setUnsupported(true)
      setTimeout(() => setUnsupported(false), 3000)
      return
    }

    if (listening) {
      // 用户主动停止
      recognitionRef.current?.stop()
      return
    }

    // 开始持续监听
    accumulatedRef.current = ''

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.continuous = true      // 持续监听，不会因停顿自动停止
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      // 拼接本次识别的最终结果
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          accumulatedRef.current += event.results[i][0]?.transcript || ''
        }
      }
    }

    recognition.onerror = (event) => {
      // no-speech 等非致命错误不停止，继续监听
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return
      }
      // 致命错误才停止
      setListening(false)
    }

    recognition.onend = () => {
      // continuous=true 时，onend 只在主动 stop() 或致命错误后触发
      // 此时将累积结果传给父组件
      const finalText = accumulatedRef.current.trim()
      if (finalText && onResult) {
        onResult(finalText)
      }
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
      {listening ? '⏹' : '🎤'}
    </button>
  )
}
