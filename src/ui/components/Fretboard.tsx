import type { FretRange } from '../../core/fretboard/fretboard'
import type { Instrument } from '../../core/instruments/types'
import styles from './Fretboard.module.css'

export type FretboardMarkStatus = 'upcoming' | 'current' | 'correct' | 'wrong'

export interface FretboardMark {
  string: number
  fret: number
  status: FretboardMarkStatus
}

export interface FretboardProps {
  instrument: Instrument
  fretRange: FretRange
  marks: FretboardMark[]
}

const INLAY_FRETS = [3, 5, 7, 9]
const DOUBLE_INLAY_FRET = 12
const WIDTH = 640
const HEIGHT = 200
const MARGIN_X = 28
const MARGIN_Y = 24

/**
 * The hero fretboard: a horizontal SVG with a rosewood board, nickel frets
 * and strings, pearl inlays, and note dots that light up as they're played
 * (PLAN.md section 7). Fret spacing is uniform rather than physically
 * tapered, which keeps the layout simple and legible at any position.
 */
export function Fretboard({ instrument, fretRange, marks }: FretboardProps) {
  const fretCount = fretRange.max - fretRange.min
  const cellWidth = (WIDTH - MARGIN_X * 2) / (fretCount + 1)
  const stringCount = instrument.strings.length
  const stringSpacing = (HEIGHT - MARGIN_Y * 2) / (stringCount - 1)

  const cellLeft = (fret: number) => MARGIN_X + (fret - fretRange.min) * cellWidth
  const cellCenterX = (fret: number) => cellLeft(fret) + cellWidth / 2
  const stringY = (stringIndex: number) => MARGIN_Y + stringIndex * stringSpacing

  const wires = Array.from({ length: fretCount + 2 }, (_, i) => fretRange.min + i)
  const inlayFrets = [...INLAY_FRETS, DOUBLE_INLAY_FRET].filter(
    (f) => f >= fretRange.min && f <= fretRange.max,
  )

  return (
    <svg
      className={styles.fretboard}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Fretboard, frets ${fretRange.min} to ${fretRange.max}`}
    >
      <rect
        x={MARGIN_X}
        y={MARGIN_Y - 8}
        width={WIDTH - MARGIN_X * 2}
        height={HEIGHT - (MARGIN_Y - 8) * 2}
        className={styles.board}
        rx={4}
      />

      {inlayFrets.map((fret) =>
        fret === DOUBLE_INLAY_FRET ? (
          <g key={fret}>
            <circle cx={cellCenterX(fret)} cy={HEIGHT / 2 - 14} r={5} className={styles.inlay} />
            <circle cx={cellCenterX(fret)} cy={HEIGHT / 2 + 14} r={5} className={styles.inlay} />
          </g>
        ) : (
          <circle
            key={fret}
            cx={cellCenterX(fret)}
            cy={HEIGHT / 2}
            r={5}
            className={styles.inlay}
          />
        ),
      )}

      {wires.map((fret) => (
        <line
          key={fret}
          x1={cellLeft(fret)}
          x2={cellLeft(fret)}
          y1={MARGIN_Y - 8}
          y2={HEIGHT - MARGIN_Y + 8}
          className={fret === 0 && fretRange.min === 0 ? styles.nut : styles.fretWire}
        />
      ))}

      {instrument.strings.map((_, stringIndex) => (
        <line
          key={stringIndex}
          x1={MARGIN_X}
          x2={WIDTH - MARGIN_X}
          y1={stringY(stringIndex)}
          y2={stringY(stringIndex)}
          className={styles.string}
          strokeWidth={1 + ((stringCount - 1 - stringIndex) / (stringCount - 1)) * 1.8}
        />
      ))}

      {marks.map((mark, i) => (
        <circle
          key={i}
          cx={cellCenterX(mark.fret)}
          cy={stringY(mark.string)}
          r={9}
          className={`${styles.dot} ${styles[mark.status]}`}
        />
      ))}
    </svg>
  )
}
