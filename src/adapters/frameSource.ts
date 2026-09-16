import type { AudioFrame } from '../core/audio/frame'

/**
 * A live source of AudioFrames (mic, file playback, ...). Kept as an
 * interface so the mic path can move from AnalyserNode polling to an
 * AudioWorklet later without touching anything downstream (PLAN.md section
 * 4, constraint 7).
 */
export interface FrameSource {
  readonly sampleRate: number
  start(): Promise<void>
  stop(): void
  setOnFrame(callback: ((frame: AudioFrame) => void) | null): void
}
