import type { Instrument } from '../../instruments/types'
import type { Midi } from '../../theory/pitch'
import type { FretLocation } from '../fretboard'

export interface PositionOptions {
  /** 'full' (default): lowest to highest scale note in the position. 'rootToRoot': trim to the root span. */
  range?: 'full' | 'rootToRoot'
  /** Which finger takes the one note outside the core 4-fret window. Default 'pinky'. */
  stretch?: 'pinky' | 'index'
}

export interface PositionSystem {
  id: string
  label: string
  positions(instrument: Instrument): number[]
  /** Ascending list of locations for the major scale in this key and position. */
  majorScaleShape(
    instrument: Instrument,
    keyPitchClass: Midi,
    position: number,
    opts?: PositionOptions,
  ): FretLocation[]
}
