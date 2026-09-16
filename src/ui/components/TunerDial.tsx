import styles from './TunerDial.module.css'

export interface TunerDialProps {
  noteName: string | null
  /** Cents offset from the nearest note, roughly -50..50. Null when there's no reading. */
  cents: number | null
}

const IN_TUNE_CENTS_THRESHOLD = 5
const MAX_NEEDLE_DEGREES = 45

export function TunerDial({ noteName, cents }: TunerDialProps) {
  const clampedCents = cents === null ? 0 : Math.max(-50, Math.min(50, cents))
  const needleRotation = (clampedCents / 50) * MAX_NEEDLE_DEGREES
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS_THRESHOLD

  return (
    <div className={styles.dial}>
      <div className={styles.noteName} data-testid="tuner-note">
        {noteName ?? '—'}
      </div>
      <div className={styles.needleTrack}>
        <div
          className={inTune ? `${styles.needle} ${styles.inTune}` : styles.needle}
          style={{ transform: `rotate(${needleRotation}deg)` }}
        />
      </div>
      <div className={styles.centsLabel} data-testid="tuner-cents">
        {cents === null ? ' ' : `${cents > 0 ? '+' : ''}${Math.round(cents)}¢`}
      </div>
    </div>
  )
}
