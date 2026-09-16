import type { Midi } from './pitch'

/** Semitone offsets from the root for each major scale degree. */
export const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const

const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
type Letter = (typeof LETTER_NAMES)[number]

const LETTER_PITCH_CLASS: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/**
 * The letter used to spell the root of each of the 12 major keys, matching
 * standard guitar usage (F♯ major rather than the enharmonic G♭ major, D♭
 * major rather than C♯ major, and so on). Indexed by root pitch class.
 */
const KEY_ROOT_LETTER: Letter[] = ['C', 'D', 'D', 'E', 'E', 'F', 'F', 'G', 'A', 'A', 'B', 'B']

const ACCIDENTALS_BY_DIFF: Record<number, string> = {
  [-2]: '♭♭',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '♯♯',
}

function mod12(n: number): number {
  return ((n % 12) + 12) % 12
}

export interface ScaleDegree {
  pitchClass: number
  letter: Letter
  accidental: string // '', '♯', '♭', '♯♯', or '♭♭'
  name: string // e.g. 'F♯'
}

/**
 * Diatonic spelling of the major scale for a key, one letter name per degree
 * (matching the key signature) with whatever accidental makes it land on the
 * right pitch class. Derived algorithmically rather than from a lookup table
 * of key signatures, so it generalizes cleanly.
 */
export function majorScaleSpelling(keyPitchClass: Midi): ScaleDegree[] {
  const rootPc = mod12(keyPitchClass)
  const rootLetter = KEY_ROOT_LETTER[rootPc]
  const rootLetterIndex = LETTER_NAMES.indexOf(rootLetter)

  return MAJOR_SCALE_INTERVALS.map((interval, degree) => {
    const letter = LETTER_NAMES[(rootLetterIndex + degree) % 7]
    const targetPc = mod12(rootPc + interval)
    const naturalPc = LETTER_PITCH_CLASS[letter]
    const diff = [-2, -1, 0, 1, 2].find((d) => mod12(naturalPc + d) === targetPc)
    if (diff === undefined) {
      throw new Error(`Cannot spell pitch class ${targetPc} from letter ${letter}`)
    }
    const accidental = ACCIDENTALS_BY_DIFF[diff]
    return { pitchClass: targetPc, letter, accidental, name: `${letter}${accidental}` }
  })
}

/** Pitch classes (0-11) of the major scale for a key, root first, ascending. */
export function majorScalePitchClasses(keyPitchClass: Midi): number[] {
  const rootPc = mod12(keyPitchClass)
  return MAJOR_SCALE_INTERVALS.map((interval) => mod12(rootPc + interval))
}
