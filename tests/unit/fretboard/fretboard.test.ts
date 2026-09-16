import { describe, expect, it } from 'vitest'
import { ACOUSTIC_GUITAR } from '../../../src/core/instruments/acousticGuitar'
import {
  locationsForMidi,
  locationsForPitchClass,
  midiAt,
} from '../../../src/core/fretboard/fretboard'

describe('midiAt', () => {
  it('adds the fret to the open-string MIDI note', () => {
    expect(midiAt(ACOUSTIC_GUITAR, { string: 0, fret: 0 })).toBe(40) // open low E
    expect(midiAt(ACOUSTIC_GUITAR, { string: 0, fret: 5 })).toBe(45) // A on the low E string
    expect(midiAt(ACOUSTIC_GUITAR, { string: 5, fret: 0 })).toBe(64) // open high E
  })
})

describe('locationsForMidi', () => {
  it('finds every place B3 exists within fret 0-12 (open B and fret 4 on the G string)', () => {
    const locations = locationsForMidi(ACOUSTIC_GUITAR, 59, { min: 0, max: 12 })
    expect(locations).toContainEqual({ string: 4, fret: 0 })
    expect(locations).toContainEqual({ string: 3, fret: 4 })
  })

  it('returns nothing outside the given fret range', () => {
    expect(locationsForMidi(ACOUSTIC_GUITAR, 40, { min: 1, max: 12 })).toEqual([])
  })

  it('returns nothing for a pitch below or above the guitar entirely', () => {
    expect(locationsForMidi(ACOUSTIC_GUITAR, 10, { min: 0, max: 20 })).toEqual([])
    expect(locationsForMidi(ACOUSTIC_GUITAR, 200, { min: 0, max: 20 })).toEqual([])
  })
})

describe('locationsForPitchClass', () => {
  it('finds every location of a pitch class, including every octave', () => {
    // pitch class 4 = E: open low E, open high E, and every other E in range 0-12
    const locations = locationsForPitchClass(ACOUSTIC_GUITAR, 4, { min: 0, max: 12 })
    expect(locations).toContainEqual({ string: 0, fret: 0 })
    expect(locations).toContainEqual({ string: 5, fret: 0 })
    expect(locations.length).toBeGreaterThan(2)
  })
})
