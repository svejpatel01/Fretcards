import { describe, expect, it } from 'vitest'
import { majorScalePitchClasses, majorScaleSpelling } from '../../../src/core/theory/scales'

// Root pitch class -> expected spelled major scale, for all 12 keys guitarists actually use
// (F♯ major rather than G♭ major, D♭ major rather than C♯ major).
const EXPECTED_SPELLING: Record<number, string[]> = {
  0: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], // C
  1: ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'], // D♭
  2: ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯'], // D
  3: ['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D'], // E♭
  4: ['E', 'F♯', 'G♯', 'A', 'B', 'C♯', 'D♯'], // E
  5: ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'], // F
  6: ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯'], // F♯
  7: ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'], // G
  8: ['A♭', 'B♭', 'C', 'D♭', 'E♭', 'F', 'G'], // A♭
  9: ['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'], // A
  10: ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A'], // B♭
  11: ['B', 'C♯', 'D♯', 'E', 'F♯', 'G♯', 'A♯'], // B
}

describe('majorScaleSpelling', () => {
  it('spells every degree of every key with a distinct letter, matching standard guitar key signatures', () => {
    for (const [pc, expected] of Object.entries(EXPECTED_SPELLING)) {
      const spelling = majorScaleSpelling(Number(pc)).map((d) => d.name)
      expect(spelling, `key ${pc}`).toEqual(expected)
    }
  })

  it('uses a different letter for every degree (no letter repeats within a key)', () => {
    for (let pc = 0; pc < 12; pc++) {
      const letters = majorScaleSpelling(pc).map((d) => d.letter)
      expect(new Set(letters).size, `key ${pc}`).toBe(7)
    }
  })

  it('normalizes an out-of-range or negative key pitch class', () => {
    expect(majorScaleSpelling(19).map((d) => d.name)).toEqual(majorScaleSpelling(7).map((d) => d.name))
    expect(majorScaleSpelling(-5).map((d) => d.name)).toEqual(majorScaleSpelling(7).map((d) => d.name))
  })
})

describe('majorScalePitchClasses', () => {
  it('matches the pitch classes implied by the spelling', () => {
    for (let pc = 0; pc < 12; pc++) {
      const spelled = majorScaleSpelling(pc).map((d) => d.pitchClass)
      expect(majorScalePitchClasses(pc)).toEqual(spelled)
    }
  })

  it('has the root first and 7 distinct ascending-mod-12 degrees', () => {
    for (let pc = 0; pc < 12; pc++) {
      const degrees = majorScalePitchClasses(pc)
      expect(degrees[0]).toBe(pc)
      expect(new Set(degrees).size).toBe(7)
    }
  })
})
