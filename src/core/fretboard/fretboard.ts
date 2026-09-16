import type { Instrument } from '../instruments/types'
import { pitchClass, type Midi } from '../theory/pitch'

export interface FretLocation {
  string: number // 0-indexed, low to high
  fret: number
  stretch?: 'index' | 'pinky'
}

export interface FretRange {
  min: number
  max: number
}

export function midiAt(
  instrument: Instrument,
  location: Pick<FretLocation, 'string' | 'fret'>,
): Midi {
  return instrument.strings[location.string] + location.fret
}

/** Every (string, fret) where a given MIDI note can be played, within a fret range. */
export function locationsForMidi(
  instrument: Instrument,
  midi: Midi,
  fretRange: FretRange = { min: 0, max: instrument.fretCount },
): FretLocation[] {
  const locations: FretLocation[] = []
  for (let string = 0; string < instrument.strings.length; string++) {
    const fret = midi - instrument.strings[string]
    if (fret >= fretRange.min && fret <= fretRange.max) {
      locations.push({ string, fret })
    }
  }
  return locations
}

/** Every (string, fret) where a given pitch class can be played, within a fret range. */
export function locationsForPitchClass(
  instrument: Instrument,
  pc: number,
  fretRange: FretRange = { min: 0, max: instrument.fretCount },
): FretLocation[] {
  const locations: FretLocation[] = []
  for (let string = 0; string < instrument.strings.length; string++) {
    for (let fret = fretRange.min; fret <= fretRange.max; fret++) {
      if (pitchClass(instrument.strings[string] + fret) === pc) {
        locations.push({ string, fret })
      }
    }
  }
  return locations
}
