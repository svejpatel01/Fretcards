import { PitchDetector, type PitchDetectorConfig } from '../../../src/core/audio/pitchDetector'
import {
  NoteTracker,
  type NoteEvent,
  type TrackerConfig,
} from '../../../src/core/audio/noteTracker'
import type { AudioFrame } from '../../../src/core/audio/frame'

export const WINDOW_SIZE = 2048
const HOP_SECONDS = 0.02 // ~20ms, matching PLAN.md section 6.1's "roughly every 16-20ms"

/** Runs mono samples through the real PitchDetector + NoteTracker pipeline, windowed like the mic path would be. */
export function runPipeline(
  samples: Float32Array,
  sampleRate: number,
  opts: {
    detectorConfig?: Partial<PitchDetectorConfig>
    trackerConfig?: Partial<TrackerConfig>
  } = {},
): NoteEvent[] {
  const detector = new PitchDetector(WINDOW_SIZE)
  if (opts.detectorConfig) detector.setConfig(opts.detectorConfig)
  const tracker = new NoteTracker()
  if (opts.trackerConfig) tracker.setConfig(opts.trackerConfig)

  const hopSize = Math.round(sampleRate * HOP_SECONDS)
  const events: NoteEvent[] = []

  for (let start = 0; start + WINDOW_SIZE <= samples.length; start += hopSize) {
    const frame: AudioFrame = {
      samples: samples.subarray(start, start + WINDOW_SIZE),
      sampleRate,
      time: start / sampleRate,
    }
    events.push(...tracker.process(detector.process(frame)))
  }
  return events
}
