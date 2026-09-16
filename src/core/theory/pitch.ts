export type Midi = number // integer semitone, A4 = 69

const A4_MIDI = 69
export const DEFAULT_A4_HZ = 440

/** Hz to a (possibly fractional) MIDI note number. */
export function hzToMidi(hz: number, a4Hz: number = DEFAULT_A4_HZ): number {
  return A4_MIDI + 12 * Math.log2(hz / a4Hz)
}

/** MIDI note number (integer or fractional) to Hz. */
export function midiToHz(midi: number, a4Hz: number = DEFAULT_A4_HZ): number {
  return a4Hz * 2 ** ((midi - A4_MIDI) / 12)
}

/** Offset in cents between a fractional MIDI reading and the nearest (or given) integer note. */
export function centsOffset(midiFloat: number, roundedMidi: Midi = Math.round(midiFloat)): number {
  return (midiFloat - roundedMidi) * 100
}

/** Pitch class 0-11 (0 = C), for any integer MIDI note, including negative values. */
export function pitchClass(midi: Midi): number {
  return ((midi % 12) + 12) % 12
}

/** Scientific pitch notation octave (MIDI 60 = C4). */
export function octaveOf(midi: Midi): number {
  return Math.floor(midi / 12) - 1
}

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

export interface NoteNameOptions {
  preferFlats?: boolean
  includeOctave?: boolean
}

/** Chromatic pitch-class name, e.g. "F♯" or (preferFlats) "G♭". Not key-aware; see scales.ts for scale spelling. */
export function pitchClassName(pc: number, opts: { preferFlats?: boolean } = {}): string {
  const names = opts.preferFlats ? FLAT_NAMES : SHARP_NAMES
  return names[pitchClass(pc)]
}

/** Chromatic note name with octave, e.g. "F♯3". */
export function noteName(midi: Midi, opts: NoteNameOptions = {}): string {
  const { preferFlats = false, includeOctave = true } = opts
  const name = pitchClassName(midi, { preferFlats })
  return includeOctave ? `${name}${octaveOf(midi)}` : name
}
