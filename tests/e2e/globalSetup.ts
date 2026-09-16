import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { karplusStrongPluck, silence, concatBuffers } from '../../src/core/audio/synth'
import { encodeWav } from '../../src/core/audio/wav'
import { midiToHz } from '../../src/core/theory/pitch'
import { TUNER_FIXTURE_PATH } from './fixturePaths'

/**
 * Generates the WAV fixtures fed to Chromium's fake audio capture
 * (--use-file-for-fake-audio-capture), so e2e tests can exercise the real
 * getUserMedia -> AnalyserNode mic path with a known, synthesized signal
 * (PLAN.md section 8's fake-mic e2e strategy). The file loops from the
 * start, so it leads with 1.5s of silence -- longer than the 1s noise-floor
 * calibration window -- so calibration sees real silence before the tone.
 */
export default function globalSetup(): void {
  const sampleRate = 48000
  const hz = midiToHz(64) // E4, in tune
  const lead = silence(sampleRate, 1.5)
  const tone = karplusStrongPluck(hz, { sampleRate, durationSeconds: 3, decay: 0.9995 })
  const wavBytes = encodeWav(concatBuffers(lead, tone), sampleRate)

  mkdirSync(path.dirname(TUNER_FIXTURE_PATH), { recursive: true })
  writeFileSync(TUNER_FIXTURE_PATH, Buffer.from(wavBytes))
}
