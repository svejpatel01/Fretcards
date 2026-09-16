import type { AudioFrame } from '../core/audio/frame'
import type { FrameSource } from './frameSource'

const WINDOW_SIZE = 2048
const HOP_SECONDS = 0.02 // matches the mic path's ~60fps polling cadence closely enough

/**
 * Plays back an uploaded/decoded audio file as a FrameSource, at the same
 * window size and roughly the same cadence as the mic path, so the dev
 * page (PLAN.md section 8) can drive the pipeline from a file instead of a
 * live mic.
 */
export class FileSource implements FrameSource {
  private samples: Float32Array | null = null
  private decodedSampleRate = 0
  private onFrameCallback: ((frame: AudioFrame) => void) | null = null
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private position = 0
  private readonly source: File | Blob | ArrayBuffer

  constructor(source: File | Blob | ArrayBuffer) {
    this.source = source
  }

  get sampleRate(): number {
    if (!this.decodedSampleRate) throw new Error('FileSource has not been started')
    return this.decodedSampleRate
  }

  async start(): Promise<void> {
    const arrayBuffer =
      this.source instanceof ArrayBuffer ? this.source : await this.source.arrayBuffer()
    const audioContext = new AudioContext()
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    } finally {
      void audioContext.close()
    }

    this.samples = downmixToMono(audioBuffer)
    this.decodedSampleRate = audioBuffer.sampleRate
    this.position = 0
    this.scheduleNext()
  }

  stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  setOnFrame(callback: ((frame: AudioFrame) => void) | null): void {
    this.onFrameCallback = callback
  }

  private scheduleNext(): void {
    if (!this.samples) return
    const hopSize = Math.round(this.decodedSampleRate * HOP_SECONDS)
    if (this.position + WINDOW_SIZE > this.samples.length) return // reached the end

    const frame: AudioFrame = {
      samples: this.samples.slice(this.position, this.position + WINDOW_SIZE),
      sampleRate: this.decodedSampleRate,
      time: this.position / this.decodedSampleRate,
    }
    this.onFrameCallback?.(frame)
    this.position += hopSize
    this.timeoutId = setTimeout(() => this.scheduleNext(), HOP_SECONDS * 1000)
  }
}

function downmixToMono(audioBuffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(audioBuffer.length)
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel)
    for (let i = 0; i < channelData.length; i++)
      mono[i] += channelData[i] / audioBuffer.numberOfChannels
  }
  return mono
}
