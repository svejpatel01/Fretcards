import type { Instrument } from './types'

/** Standard tuning, low to high: E2 A2 D3 G3 B3 E4. */
export const ACOUSTIC_GUITAR: Instrument = {
  id: 'acoustic-guitar',
  name: 'Acoustic guitar',
  strings: [40, 45, 50, 55, 59, 64],
  fretCount: 20,
  detectorRange: { minHz: 70, maxHz: 1100 },
  decks: [
    { id: 'note-finder', name: 'Note finder' },
    { id: 'scale-positions', name: 'Major scale positions' },
  ],
}
