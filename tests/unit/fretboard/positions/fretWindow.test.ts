import { describe, expect, it } from 'vitest'
import { ACOUSTIC_GUITAR } from '../../../../src/core/instruments/acousticGuitar'
import { midiAt, type FretLocation } from '../../../../src/core/fretboard/fretboard'
import { fretWindowPositionSystem } from '../../../../src/core/fretboard/positions/fretWindow'
import { majorScalePitchClasses } from '../../../../src/core/theory/scales'
import { noteName, pitchClass } from '../../../../src/core/theory/pitch'

const { positions, majorScaleShape } = fretWindowPositionSystem

function names(locations: FretLocation[]): string[] {
  return locations.map((loc) => noteName(midiAt(ACOUSTIC_GUITAR, loc)))
}

describe('fretWindowPositionSystem golden tests', () => {
  it('G major, position 2: 17 notes, no stretches', () => {
    const shape = majorScaleShape(ACOUSTIC_GUITAR, 7, 2)
    expect(names(shape)).toEqual([
      'F♯2',
      'G2',
      'A2',
      'B2',
      'C3',
      'D3',
      'E3',
      'F♯3',
      'G3',
      'A3',
      'B3',
      'C4',
      'D4',
      'E4',
      'F♯4',
      'G4',
      'A4',
    ])
    expect(shape).toHaveLength(17)
    expect(shape.some((loc) => loc.stretch)).toBe(false)
  })

  it('C major, position 2: 16 notes, F4 is a stretch on the B string by default', () => {
    const shape = majorScaleShape(ACOUSTIC_GUITAR, 0, 2)
    expect(names(shape)).toEqual([
      'G2',
      'A2',
      'B2',
      'C3',
      'D3',
      'E3',
      'F3',
      'G3',
      'A3',
      'B3',
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
    ])
    expect(shape).toHaveLength(16)

    const stretchNotes = shape.filter((loc) => loc.stretch)
    expect(stretchNotes).toEqual([{ string: 4, fret: 6, stretch: 'pinky' }])
  })

  it('C major, position 2, stretch: index puts the same note on the high E string, fret 1', () => {
    const shape = majorScaleShape(ACOUSTIC_GUITAR, 0, 2, { stretch: 'index' })
    const stretchNotes = shape.filter((loc) => loc.stretch)
    expect(stretchNotes).toEqual([{ string: 5, fret: 1, stretch: 'index' }])
    // Same pitches either way.
    expect(names(shape)).toEqual(names(majorScaleShape(ACOUSTIC_GUITAR, 0, 2)))
  })
})

describe('fretWindowPositionSystem property tests', () => {
  const allKeys = Array.from({ length: 12 }, (_, i) => i)
  const allPositions = positions(ACOUSTIC_GUITAR)
  const stretchOptions: Array<'pinky' | 'index'> = ['pinky', 'index']

  for (const key of allKeys) {
    for (const position of allPositions) {
      for (const stretch of stretchOptions) {
        const label = `key ${key}, position ${position}, stretch ${stretch}`

        it(`every note is in the key (${label})`, () => {
          const shape = majorScaleShape(ACOUSTIC_GUITAR, key, position, { stretch })
          const scalePcs = new Set(majorScalePitchClasses(key))
          for (const location of shape) {
            expect(scalePcs.has(pitchClass(midiAt(ACOUSTIC_GUITAR, location)))).toBe(true)
          }
        })

        it(`pitches are strictly ascending with no scale degree skipped (${label})`, () => {
          const shape = majorScaleShape(ACOUSTIC_GUITAR, key, position, { stretch })
          const scaleDegrees = majorScalePitchClasses(key)
          for (let i = 1; i < shape.length; i++) {
            const prevMidi = midiAt(ACOUSTIC_GUITAR, shape[i - 1])
            const curMidi = midiAt(ACOUSTIC_GUITAR, shape[i])
            expect(curMidi).toBeGreaterThan(prevMidi)

            const prevDegree = scaleDegrees.indexOf(pitchClass(prevMidi))
            const curDegree = scaleDegrees.indexOf(pitchClass(curMidi))
            expect((curDegree - prevDegree + 7) % 7).toBe(1)
          }
        })

        it(`every fret is within [p-1, p+4] and <= fretCount (${label})`, () => {
          const shape = majorScaleShape(ACOUSTIC_GUITAR, key, position, { stretch })
          for (const location of shape) {
            expect(location.fret).toBeGreaterThanOrEqual(position - 1)
            expect(location.fret).toBeLessThanOrEqual(position + 4)
            expect(location.fret).toBeLessThanOrEqual(ACOUSTIC_GUITAR.fretCount)
          }
        })

        it(`each string holds 2-4 notes with at most one stretch per string boundary (${label})`, () => {
          const shape = majorScaleShape(ACOUSTIC_GUITAR, key, position, { stretch })
          const byString = new Map<number, FretLocation[]>()
          for (const location of shape) {
            const list = byString.get(location.string) ?? []
            list.push(location)
            byString.set(location.string, list)
          }
          for (const [, locs] of byString) {
            expect(locs.length).toBeGreaterThanOrEqual(2)
            expect(locs.length).toBeLessThanOrEqual(4)
            expect(locs.filter((l) => l.stretch).length).toBeLessThanOrEqual(1)
          }
        })
      }
    }
  }
})
