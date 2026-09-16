import type { Midi } from '../theory/pitch'

export interface DeckDefinition {
  id: string
  name: string
}

export interface DetectorRange {
  minHz: number
  maxHz: number
}

export interface Instrument {
  id: string
  name: string
  strings: Midi[] // low -> high, e.g. [40, 45, 50, 55, 59, 64] for standard-tuned guitar
  fretCount: number // physical frets; UI defaults to 0-12
  detectorRange: DetectorRange
  decks: DeckDefinition[]
}
