import { describe, expect, it } from 'vitest'
import { centsOffset, hzToMidi, midiToHz, noteName, octaveOf, pitchClass, pitchClassName } from '../../../src/core/theory/pitch'

describe('hzToMidi / midiToHz round trips', () => {
  it('recovers known tuning frequencies as integer MIDI notes', () => {
    const tuning: [number, number][] = [
      [82.41, 40], // E2
      [110.0, 45], // A2
      [146.83, 50], // D3
      [196.0, 55], // G3
      [246.94, 59], // B3
      [329.63, 64], // E4
      [440, 69], // A4
    ]
    for (const [hz, midi] of tuning) {
      expect(Math.round(hzToMidi(hz))).toBe(midi)
    }
  })

  it('round-trips Hz -> MIDI -> Hz for arbitrary frequencies', () => {
    for (const hz of [82.41, 110, 220, 440, 523.25, 1046.5]) {
      expect(midiToHz(hzToMidi(hz))).toBeCloseTo(hz, 6)
    }
  })

  it('round-trips MIDI -> Hz -> MIDI for arbitrary notes', () => {
    for (const midi of [40, 45, 50, 55, 59, 64, 69, 80]) {
      expect(hzToMidi(midiToHz(midi))).toBeCloseTo(midi, 9)
    }
  })

  it('respects a non-default A4 reference', () => {
    expect(Math.round(hzToMidi(442, 442))).toBe(69)
    expect(midiToHz(69, 442)).toBeCloseTo(442, 6)
  })
})

describe('centsOffset', () => {
  it('is zero exactly on pitch', () => {
    expect(centsOffset(69)).toBe(0)
  })

  it('is positive when sharp and negative when flat, scaled to +-100 per semitone', () => {
    expect(centsOffset(69.4)).toBeCloseTo(40, 9)
    expect(centsOffset(68.6)).toBeCloseTo(-40, 9)
    expect(centsOffset(69.1)).toBeCloseTo(10, 9)
  })

  it('measures against an explicit rounded note when given one', () => {
    expect(centsOffset(69.9, 70)).toBeCloseTo(-10, 9)
  })
})

describe('pitchClass', () => {
  it('wraps into 0-11 for positive and negative MIDI values', () => {
    expect(pitchClass(60)).toBe(0) // C4
    expect(pitchClass(61)).toBe(1)
    expect(pitchClass(40)).toBe(4) // E2
    expect(pitchClass(-1)).toBe(11)
    expect(pitchClass(-12)).toBe(0)
  })
})

describe('octaveOf', () => {
  it('matches scientific pitch notation for the standard guitar tuning', () => {
    expect(octaveOf(40)).toBe(2) // E2
    expect(octaveOf(45)).toBe(2) // A2
    expect(octaveOf(50)).toBe(3) // D3
    expect(octaveOf(55)).toBe(3) // G3
    expect(octaveOf(59)).toBe(3) // B3
    expect(octaveOf(64)).toBe(4) // E4
    expect(octaveOf(60)).toBe(4) // C4 (middle C)
    expect(octaveOf(69)).toBe(4) // A4
  })
})

describe('pitchClassName / noteName', () => {
  it('spells sharps by default', () => {
    expect(pitchClassName(6)).toBe('F♯')
    expect(noteName(66)).toBe('F♯4')
  })

  it('spells flats when preferFlats is set', () => {
    expect(pitchClassName(6, { preferFlats: true })).toBe('G♭')
    expect(noteName(66, { preferFlats: true })).toBe('G♭4')
  })

  it('can omit the octave', () => {
    expect(noteName(66, { includeOctave: false })).toBe('F♯')
  })

  it('names naturals the same regardless of accidental preference', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(60, { preferFlats: true })).toBe('C4')
  })
})
