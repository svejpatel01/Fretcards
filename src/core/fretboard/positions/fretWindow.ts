import type { Instrument } from '../../instruments/types'
import { pitchClass, type Midi } from '../../theory/pitch'
import { majorScalePitchClasses } from '../../theory/scales'
import { midiAt, type FretLocation } from '../fretboard'
import type { PositionOptions, PositionSystem } from './types'

const HIGHEST_POSITION = 12
const CORE_WINDOW_SPAN = 3 // core window is [position, position + 3]
const PERFECT_FOURTH_SEMITONES = 5 // the string-pair gap only exists at this interval; G→B (4) has none

function positions(instrument: Instrument): number[] {
  const result: number[] = []
  for (let p = 0; p <= HIGHEST_POSITION; p++) {
    if (p + CORE_WINDOW_SPAN <= instrument.fretCount) result.push(p)
  }
  return result
}

function coreWindowLocations(
  instrument: Instrument,
  scalePitchClasses: ReadonlySet<number>,
  position: number,
): FretLocation[] {
  const locations: FretLocation[] = []
  for (let string = 0; string < instrument.strings.length; string++) {
    for (let fret = position; fret <= position + CORE_WINDOW_SPAN; fret++) {
      if (fret < 0) continue
      if (scalePitchClasses.has(pitchClass(instrument.strings[string] + fret))) {
        locations.push({ string, fret })
      }
    }
  }
  return locations
}

function stretchLocations(
  instrument: Instrument,
  scalePitchClasses: ReadonlySet<number>,
  position: number,
  stretch: 'pinky' | 'index',
): FretLocation[] {
  const locations: FretLocation[] = []
  for (let string = 0; string < instrument.strings.length - 1; string++) {
    const isPerfectFourthPair =
      instrument.strings[string + 1] - instrument.strings[string] === PERFECT_FOURTH_SEMITONES
    if (!isPerfectFourthPair) continue

    const gapFret = position + CORE_WINDOW_SPAN + 1 // p + 4, on the lower string
    const gapPc = pitchClass(instrument.strings[string] + gapFret)
    if (!scalePitchClasses.has(gapPc)) continue

    if (stretch === 'pinky') {
      locations.push({ string, fret: gapFret, stretch: 'pinky' })
      continue
    }

    const upperFret = position - 1
    if (upperFret >= 0) {
      locations.push({ string: string + 1, fret: upperFret, stretch: 'index' })
    } else {
      // No room for the index finger below the nut; fall back to the pinky voicing.
      locations.push({ string, fret: gapFret, stretch: 'pinky' })
    }
  }
  return locations
}

function trimToRootSpan(
  instrument: Instrument,
  locations: FretLocation[],
  keyPitchClass: Midi,
): FretLocation[] {
  const rootPc = pitchClass(keyPitchClass)
  const rootIndices: number[] = []
  locations.forEach((location, i) => {
    if (pitchClass(midiAt(instrument, location)) === rootPc) rootIndices.push(i)
  })
  if (rootIndices.length < 2) return locations
  return locations.slice(rootIndices[0], rootIndices[rootIndices.length - 1] + 1)
}

function majorScaleShape(
  instrument: Instrument,
  keyPitchClass: Midi,
  position: number,
  opts: PositionOptions = {},
): FretLocation[] {
  const stretch = opts.stretch ?? 'pinky'
  const scalePitchClasses = new Set(majorScalePitchClasses(keyPitchClass))

  const locations = [
    ...coreWindowLocations(instrument, scalePitchClasses, position),
    ...stretchLocations(instrument, scalePitchClasses, position, stretch),
  ].sort((a, b) => midiAt(instrument, a) - midiAt(instrument, b))

  return opts.range === 'rootToRoot'
    ? trimToRootSpan(instrument, locations, keyPitchClass)
    : locations
}

export const fretWindowPositionSystem: PositionSystem = {
  id: 'fret-window',
  label: 'Fret position',
  positions,
  majorScaleShape,
}
