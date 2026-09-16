import { describe, expect, it } from 'vitest'
import {
  addNoiseAtSnr,
  concatBuffers,
  harmonicTone,
  karplusStrongPluck,
  silence,
  whiteNoise,
} from '../../../src/core/audio/synth'

function rms(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

describe('karplusStrongPluck', () => {
  it('produces the requested number of samples', () => {
    const samples = karplusStrongPluck(220, { sampleRate: 48000, durationSeconds: 0.5 })
    expect(samples.length).toBe(24000)
  })

  it('is deterministic for the same (default) seed', () => {
    const a = karplusStrongPluck(220, { sampleRate: 48000, durationSeconds: 0.1 })
    const b = karplusStrongPluck(220, { sampleRate: 48000, durationSeconds: 0.1 })
    expect(a).toEqual(b)
  })

  it('produces different output for different seeds', () => {
    const a = karplusStrongPluck(220, { sampleRate: 48000, durationSeconds: 0.1, seed: 1 })
    const b = karplusStrongPluck(220, { sampleRate: 48000, durationSeconds: 0.1, seed: 2 })
    expect(a).not.toEqual(b)
  })

  it('decays over time (later samples are quieter than earlier ones)', () => {
    const samples = karplusStrongPluck(220, { sampleRate: 48000, durationSeconds: 1 })
    const firstHalf = samples.subarray(0, samples.length / 2)
    const secondHalf = samples.subarray(samples.length / 2)
    expect(rms(secondHalf)).toBeLessThan(rms(firstHalf))
  })
})

describe('harmonicTone', () => {
  it('produces the requested number of samples', () => {
    const samples = harmonicTone(440, {
      sampleRate: 44100,
      durationSeconds: 0.25,
      harmonicAmplitudes: [1],
    })
    expect(samples.length).toBe(11025)
  })

  it('stays within [-1, 1]', () => {
    const samples = harmonicTone(440, {
      sampleRate: 44100,
      durationSeconds: 0.25,
      harmonicAmplitudes: [0.3, 1.0, 0.2],
    })
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(-1)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
})

describe('whiteNoise', () => {
  it('is deterministic for the same seed and bounded by amplitude', () => {
    const a = whiteNoise(1000, 0.5, 7)
    const b = whiteNoise(1000, 0.5, 7)
    expect(a).toEqual(b)
    for (const s of a) {
      expect(Math.abs(s)).toBeLessThanOrEqual(0.5)
    }
  })
})

describe('addNoiseAtSnr', () => {
  it('achieves approximately the requested SNR', () => {
    const signal = karplusStrongPluck(440, { sampleRate: 48000, durationSeconds: 0.3 })
    const signalRms = rms(signal)
    const noisy = addNoiseAtSnr(signal, 20)

    const noiseOnly = new Float32Array(signal.length)
    for (let i = 0; i < signal.length; i++) noiseOnly[i] = noisy[i] - signal[i]
    const noiseRms = rms(noiseOnly)

    const achievedSnrDb = 20 * Math.log10(signalRms / noiseRms)
    expect(achievedSnrDb).toBeCloseTo(20, 0)
  })
})

describe('silence', () => {
  it('is all zeros, with the requested length', () => {
    const samples = silence(48000, 0.1)
    expect(samples.length).toBe(4800)
    expect(samples.every((s) => s === 0)).toBe(true)
  })
})

describe('concatBuffers', () => {
  it('concatenates in order', () => {
    const a = new Float32Array([1, 2])
    const b = new Float32Array([3, 4, 5])
    expect(Array.from(concatBuffers(a, b))).toEqual([1, 2, 3, 4, 5])
  })
})
