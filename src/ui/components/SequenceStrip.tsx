import { noteName } from '../../core/theory/pitch'
import type { ScaleMistake } from '../../core/exercises/scaleDeck'
import type { Midi } from '../../core/theory/pitch'
import styles from './SequenceStrip.module.css'

export interface SequenceStripProps {
  expected: Midi[]
  currentIndex: number
  mistakes: ScaleMistake[]
  preferFlats?: boolean
}

function mistakeLabel(mistake: ScaleMistake, preferFlats: boolean): string {
  if (mistake.kind === 'skipped') return 'skipped'
  return noteName(mistake.heardMidi, { includeOctave: false, preferFlats })
}

/** Every expected note as a chip; chips fill in as they're played, the current chip is highlighted. */
export function SequenceStrip({
  expected,
  currentIndex,
  mistakes,
  preferFlats = false,
}: SequenceStripProps) {
  const mistakesByIndex = new Map<number, ScaleMistake[]>()
  for (const mistake of mistakes) {
    const list = mistakesByIndex.get(mistake.index) ?? []
    list.push(mistake)
    mistakesByIndex.set(mistake.index, list)
  }

  return (
    <div className={styles.strip}>
      {expected.map((midi, i) => {
        const status = i < currentIndex ? 'played' : i === currentIndex ? 'current' : 'upcoming'
        const chipMistakes = mistakesByIndex.get(i) ?? []
        return (
          <div key={i} className={styles.chipWrap}>
            <div className={`${styles.chip} ${styles[status]}`}>
              {noteName(midi, { includeOctave: false, preferFlats })}
            </div>
            {chipMistakes.length > 0 && (
              <div className={styles.mistakes}>
                {chipMistakes.map((m, j) => (
                  <span key={j}>{mistakeLabel(m, preferFlats)}</span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
