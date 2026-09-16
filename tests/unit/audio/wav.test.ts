import { describe, expect, it } from 'vitest'
import { decodeWav, encodeWav } from '../../../src/core/audio/wav'
import { karplusStrongPluck } from '../../../src/core/audio/synth'

describe('encodeWav / decodeWav round trip', () => {
  it('recovers the sample rate and samples (within 16-bit quantization) for a synthesized tone', () => {
    const sampleRate = 44100
    const original = karplusStrongPluck(220, { sampleRate, durationSeconds: 0.2 })

    const wavBytes = encodeWav(original, sampleRate)
    const decoded = decodeWav(wavBytes)

    expect(decoded.sampleRate).toBe(sampleRate)
    expect(decoded.samples.length).toBe(original.length)
    for (let i = 0; i < original.length; i++) {
      expect(decoded.samples[i]).toBeCloseTo(original[i], 4) // 16-bit PCM: ~1/32768 quantization
    }
  })

  it('round-trips silence', () => {
    const sampleRate = 48000
    const original = new Float32Array(1000)
    const decoded = decodeWav(encodeWav(original, sampleRate))
    expect(decoded.sampleRate).toBe(sampleRate)
    expect(Array.from(decoded.samples)).toEqual(Array.from(original))
  })

  it('clamps out-of-range samples instead of overflowing', () => {
    const original = new Float32Array([1.5, -1.5, 0])
    const decoded = decodeWav(encodeWav(original, 44100))
    expect(decoded.samples[0]).toBeCloseTo(1, 4)
    expect(decoded.samples[1]).toBeCloseTo(-1, 4)
    expect(decoded.samples[2]).toBeCloseTo(0, 4)
  })
})

describe('decodeWav error handling', () => {
  it('rejects a buffer that is not RIFF/WAVE', () => {
    const bogus = new ArrayBuffer(20)
    expect(() => decodeWav(bogus)).toThrow(/RIFF\/WAVE/)
  })

  it('rejects a WAVE file missing a data chunk', () => {
    // Minimal RIFF/WAVE header with a fmt chunk but no data chunk.
    const buffer = new ArrayBuffer(12 + 8 + 16)
    const view = new DataView(buffer)
    const writeAscii = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
    }
    writeAscii(0, 'RIFF')
    view.setUint32(4, buffer.byteLength - 8, true)
    writeAscii(8, 'WAVE')
    writeAscii(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // mono
    view.setUint32(24, 44100, true)
    view.setUint32(28, 44100 * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)

    expect(() => decodeWav(buffer)).toThrow(/data/)
  })
})
