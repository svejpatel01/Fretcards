import { PitchDetector as McLeodPitchDetector } from 'pitchy'
import type { AudioFrame } from './frame'

export interface PitchReading {
  time: number
  hz: number | null
  clarity: number
  rms: number
}

export interface PitchDetectorConfig {
  /** 0..1; readings with a lower clarity than this are treated as unpitched. Plan default: 0.90. */
  clarityThreshold: number
  detectorRange: { minHz: number; maxHz: number }
}

export const DEFAULT_PITCH_DETECTOR_CONFIG: PitchDetectorConfig = {
  clarityThreshold: 0.9,
  detectorRange: { minHz: 70, maxHz: 1100 },
}

/**
 * Wraps pitchy's McLeod Pitch Method detector, applying the plan's clarity
 * and detector-range gates so callers only ever see a valid Hz or null.
 * (The silence gate and note-onset/offset state machine live in
 * NoteTracker, not here — this class is purely per-frame pitch estimation.)
 */
export class PitchDetector {
  private detector: McLeodPitchDetector<Float32Array>
  private config: PitchDetectorConfig

  constructor(windowSize: number, config: PitchDetectorConfig = DEFAULT_PITCH_DETECTOR_CONFIG) {
    this.detector = McLeodPitchDetector.forFloat32Array(windowSize)
    this.config = config
    this.detector.clarityThreshold = config.clarityThreshold
  }

  setConfig(config: Partial<PitchDetectorConfig>): void {
    this.config = { ...this.config, ...config }
    this.detector.clarityThreshold = this.config.clarityThreshold
  }

  process(frame: AudioFrame): PitchReading {
    const [hz, clarity] = this.detector.findPitch(frame.samples, frame.sampleRate)
    const rms = computeRms(frame.samples)

    const isUnpitched = hz === 0 || clarity < this.config.clarityThreshold
    const isOutOfRange =
      hz < this.config.detectorRange.minHz || hz > this.config.detectorRange.maxHz

    return {
      time: frame.time,
      hz: isUnpitched || isOutOfRange ? null : hz,
      clarity,
      rms,
    }
  }
}

function computeRms(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}

export function rmsToDb(rms: number, refAmplitude: number = 1): number {
  if (rms <= 0) return -Infinity
  return 20 * Math.log10(rms / refAmplitude)
}
