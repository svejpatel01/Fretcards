import type { Instrument } from './types'
import { ACOUSTIC_GUITAR } from './acousticGuitar'

/** Only acoustic guitar is enabled in v1; others (electric, bass, ukulele) come later. */
export const INSTRUMENTS: Instrument[] = [ACOUSTIC_GUITAR]

export function getInstrument(id: string): Instrument | undefined {
  return INSTRUMENTS.find((instrument) => instrument.id === id)
}
