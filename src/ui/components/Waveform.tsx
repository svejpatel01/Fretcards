import { useEffect, useRef } from 'react'
import styles from './Waveform.module.css'

export interface WaveformProps {
  samples: Float32Array | null
  width?: number
  height?: number
}

export function Waveform({ samples, width = 512, height = 128 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !samples) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath()
    for (let i = 0; i < samples.length; i++) {
      const x = (i / samples.length) * canvas.width
      const y = canvas.height / 2 - samples[i] * (canvas.height / 2)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--cyan').trim() || '#22e3ff'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }, [samples])

  return <canvas ref={canvasRef} width={width} height={height} className={styles.waveform} />
}
