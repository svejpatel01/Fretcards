import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { karplusStrongPluck, silence, concatBuffers } from '../../src/core/audio/synth'
import { encodeWav } from '../../src/core/audio/wav'
import { midiToHz } from '../../src/core/theory/pitch'
import { SCALE_MISTAKE_FIXTURE_PATH, TUNER_FIXTURE_PATH } from './fixturePaths'

/**
 * Generates the WAV fixtures fed to Chromium's fake audio capture
 * (--use-file-for-fake-audio-capture), so e2e tests can exercise the real
 * getUserMedia -> AnalyserNode mic path with a known, synthesized signal
 * (PLAN.md section 8's fake-mic e2e strategy). Each file loops from the
 * start, so it leads with 1.5s of silence -- longer than the 1s noise-floor
 * calibration window -- so calibration sees real silence before the tone.
 */
export default function globalSetup(): void {
  writeWavFixture(TUNER_FIXTURE_PATH, [{ midi: 64, durationSeconds: 3 }]) // E4, in tune

  // G major, position 2's first expected note is F#2 (midi 42, per the Phase 1
  // golden test). F2 (midi 41) is neither that, nor the next expected note
  // (G2), nor the same pitch class -- a clean, unambiguous "wrong note".
  writeWavFixture(SCALE_MISTAKE_FIXTURE_PATH, [{ midi: 41, durationSeconds: 1.5 }])
}

function writeWavFixture(filePath: string, notes: { midi: number; durationSeconds: number }[]): void {
  const sampleRate = 48000
  const lead = silence(sampleRate, 1.5)
  const tones = notes.map((note) =>
    karplusStrongPluck(midiToHz(note.midi), { sampleRate, durationSeconds: note.durationSeconds, decay: 0.9995 }),
  )
  const wavBytes = encodeWav(concatBuffers(lead, ...tones), sampleRate)

  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, Buffer.from(wavBytes))
}
