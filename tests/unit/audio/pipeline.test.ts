import { describe, expect, it } from 'vitest'
import { ACOUSTIC_GUITAR } from '../../../src/core/instruments/acousticGuitar'
import { midiToHz } from '../../../src/core/theory/pitch'
import {
  addNoiseAtSnr,
  harmonicTone,
  karplusStrongPluck,
  silence,
  concatBuffers,
  whiteNoise,
} from '../../../src/core/audio/synth'
import { runPipeline } from './pipelineHarness'

const SAMPLE_RATES = [44100, 48000]
const PLUCK_DURATION = 0.35

describe('pipeline: every string x fret 0-15, at 44.1kHz and 48kHz', () => {
  for (const sampleRate of SAMPLE_RATES) {
    for (let string = 0; string < ACOUSTIC_GUITAR.strings.length; string++) {
      for (let fret = 0; fret <= 15; fret++) {
        const midi = ACOUSTIC_GUITAR.strings[string] + fret
        it(`string ${string} fret ${fret} (midi ${midi}) @ ${sampleRate}Hz: exactly one onset with the right MIDI`, () => {
          const samples = karplusStrongPluck(midiToHz(midi), {
            sampleRate,
            durationSeconds: PLUCK_DURATION,
          })
          const events = runPipeline(samples, sampleRate)
          const onsets = events.filter((e) => e.type === 'onset')
          expect(onsets).toHaveLength(1)
          expect(onsets[0]).toMatchObject({ midi })
        })
      }
    }
  }
})

describe('pipeline: weak fundamental (octave-error stress test)', () => {
  // A weak fundamental relative to the 2nd harmonic is the classic setup for an
  // octave detection error (PLAN.md section 4, constraint 2), most likely on
  // the low strings where mics/preamps often roll off the fundamental.
  const sampleRate = 48000
  const lowStringMidis = [40, 41, 45, 46] // open low E, fret 1, open A, fret 1

  for (const midi of lowStringMidis) {
    it(`midi ${midi} with an attenuated fundamental still detects the fundamental, not the octave above`, () => {
      const samples = harmonicTone(midiToHz(midi), {
        sampleRate,
        durationSeconds: PLUCK_DURATION,
        harmonicAmplitudes: [0.3, 1.0], // fundamental at 30%, 2nd harmonic (the octave) at 100%
      })
      const events = runPipeline(samples, sampleRate)
      const onsets = events.filter((e) => e.type === 'onset')
      expect(onsets).toHaveLength(1)
      expect(onsets[0]).toMatchObject({ midi })
    })
  }
})

describe('pipeline: white noise at 20dB SNR', () => {
  const sampleRate = 48000

  for (const midi of [40, 52, 64, 76]) {
    it(`midi ${midi} is still detected correctly with 20dB SNR noise mixed in`, () => {
      const clean = karplusStrongPluck(midiToHz(midi), {
        sampleRate,
        durationSeconds: PLUCK_DURATION,
      })
      const noisy = addNoiseAtSnr(clean, 20)
      const events = runPipeline(noisy, sampleRate)
      const onsets = events.filter((e) => e.type === 'onset')
      expect(onsets).toHaveLength(1)
      expect(onsets[0]).toMatchObject({ midi })
    })
  }
})

describe('pipeline: sequences', () => {
  const sampleRate = 48000

  it('a repeated identical note (with a silence gap) yields two onsets', () => {
    const pluck = karplusStrongPluck(midiToHz(60), { sampleRate, durationSeconds: 0.3 })
    const gap = silence(sampleRate, 0.3)
    const sequence = concatBuffers(pluck, gap, pluck)

    const events = runPipeline(sequence, sampleRate)
    const onsets = events.filter((e) => e.type === 'onset')
    expect(onsets).toHaveLength(2)
    expect(onsets.every((e) => e.type === 'onset' && e.midi === 60)).toBe(true)
    expect(events.some((e) => e.type === 'offset')).toBe(true)
  })

  it('back-to-back plucks of different notes (a re-pick) yield an offset then a new onset', () => {
    const noteA = karplusStrongPluck(midiToHz(60), { sampleRate, durationSeconds: 0.3 })
    const noteB = karplusStrongPluck(midiToHz(62), { sampleRate, durationSeconds: 0.3, seed: 2 })
    const sequence = concatBuffers(noteA, noteB)

    const events = runPipeline(sequence, sampleRate)
    expect(events).toEqual([
      expect.objectContaining({ type: 'onset', midi: 60 }),
      expect.objectContaining({ type: 'offset' }),
      expect.objectContaining({ type: 'onset', midi: 62 }),
    ])
  })

  it('an unpitched noise burst yields no onset', () => {
    const burst = whiteNoise(Math.round(sampleRate * 0.3), 0.3)
    const events = runPipeline(burst, sampleRate)
    expect(events.filter((e) => e.type === 'onset')).toHaveLength(0)
  })

  it('silence throughout yields no events', () => {
    const events = runPipeline(silence(sampleRate, 0.5), sampleRate)
    expect(events).toEqual([])
  })
})
