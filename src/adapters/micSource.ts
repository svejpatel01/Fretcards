import type { AudioFrame } from '../core/audio/frame'
import type { FrameSource } from './frameSource'

const WINDOW_SIZE = 2048 // PLAN.md section 4, constraint 8

/**
 * Live microphone input as a FrameSource: getUserMedia -> AnalyserNode,
 * polled on requestAnimationFrame (no ScriptProcessorNode; PLAN.md section
 * 4, constraint 7). Voice-processing (echo cancellation, noise suppression,
 * AGC) is explicitly disabled, since it treats a sustained guitar tone as
 * noise (constraint 4).
 */
export class MicSource implements FrameSource {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private onFrameCallback: ((frame: AudioFrame) => void) | null = null
  private rafId: number | null = null
  private startTime = 0
  private readonly deviceId: string | null

  /** `deviceId`: a specific input device (from Settings), or null/omitted for the system default. */
  constructor(deviceId: string | null = null) {
    this.deviceId = deviceId
  }

  get sampleRate(): number {
    if (!this.audioContext) throw new Error('MicSource has not been started')
    return this.audioContext.sampleRate
  }

  /** Must be called from a user gesture (click/tap) — Safari and iOS require it to create/resume an AudioContext. */
  async start(): Promise<void> {
    const audioContext = new AudioContext()
    if (audioContext.state === 'suspended') await audioContext.resume()

    let mediaStream: MediaStream
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(this.deviceId ? { deviceId: { exact: this.deviceId } } : {}),
        },
      })
    } catch (error) {
      await audioContext.close()
      throw error
    }

    const sourceNode = audioContext.createMediaStreamSource(mediaStream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = WINDOW_SIZE
    // Deliberately not connected to audioContext.destination: we only read the signal, never play it back.
    sourceNode.connect(analyser)

    this.audioContext = audioContext
    this.mediaStream = mediaStream
    this.sourceNode = sourceNode
    this.analyser = analyser
    this.startTime = audioContext.currentTime
    this.poll()
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.sourceNode?.disconnect()
    this.mediaStream?.getTracks().forEach((track) => track.stop())
    void this.audioContext?.close()
    this.audioContext = null
    this.mediaStream = null
    this.sourceNode = null
    this.analyser = null
  }

  setOnFrame(callback: ((frame: AudioFrame) => void) | null): void {
    this.onFrameCallback = callback
  }

  private poll = (): void => {
    if (!this.analyser || !this.audioContext) return
    // A fresh array per frame: reusing one buffer would let AudioFrames alias
    // each other's samples, which is safe for the pipeline (it only reads
    // scalars out per frame) but a trap for anything that retains a frame.
    const samples = new Float32Array(WINDOW_SIZE)
    this.analyser.getFloatTimeDomainData(samples)
    this.onFrameCallback?.({
      samples,
      sampleRate: this.audioContext.sampleRate,
      time: this.audioContext.currentTime - this.startTime,
    })
    this.rafId = requestAnimationFrame(this.poll)
  }
}
