import { rmsToDb } from '../../core/audio/pitchDetector'
import styles from './LevelMeter.module.css'

export interface LevelMeterProps {
  rms: number
  /** The current silence gate, in dBFS, marked on the meter if given. */
  gateDb?: number
  minDb?: number
  maxDb?: number
}

export function LevelMeter({ rms, gateDb, minDb = -60, maxDb = 0 }: LevelMeterProps) {
  const clamp = (db: number) => Math.max(minDb, Math.min(maxDb, db))
  const toPercent = (db: number) => ((clamp(db) - minDb) / (maxDb - minDb)) * 100

  const db = rmsToDb(rms)
  const percent = toPercent(db)
  const gatePercent = gateDb !== undefined && Number.isFinite(gateDb) ? toPercent(gateDb) : null

  return (
    <div
      className={styles.meter}
      role="meter"
      aria-label="Input level"
      aria-valuenow={Number.isFinite(db) ? Math.round(db) : minDb}
      aria-valuemin={minDb}
      aria-valuemax={maxDb}
    >
      <div className={styles.fill} style={{ width: `${percent}%` }} />
      {gatePercent !== null && (
        <div className={styles.gateMarker} style={{ left: `${gatePercent}%` }} />
      )}
    </div>
  )
}
