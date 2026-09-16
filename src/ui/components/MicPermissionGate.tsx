import type { ReactNode } from 'react'
import type { AudioEngineStatus } from '../hooks/useAudioEngine'
import styles from './MicPermissionGate.module.css'

export interface MicPermissionGateProps {
  status: AudioEngineStatus
  error: string | null
  calibrationProgress: number
  onStart: () => void
  onSkipCalibration: () => void
  children: ReactNode
}

/**
 * Gates its children behind the mic permission + noise-floor calibration
 * flow (PLAN.md section 7: explain before prompting; section 6.1: a
 * one-time, skippable "stay quiet" calibration step).
 */
export function MicPermissionGate({
  status,
  error,
  calibrationProgress,
  onStart,
  onSkipCalibration,
  children,
}: MicPermissionGateProps) {
  if (status === 'ready') return <>{children}</>

  return (
    <div className={styles.gate}>
      {status === 'idle' && (
        <>
          <p>
            This needs your microphone to listen to what you play. Audio is processed on this device
            and never uploaded anywhere.
          </p>
          <button type="button" onClick={onStart}>
            Enable microphone
          </button>
        </>
      )}

      {status === 'requesting-permission' && <p>Requesting microphone access…</p>}

      {status === 'calibrating' && (
        <>
          <p>Stay quiet for a second — measuring your room&apos;s noise floor…</p>
          <progress className={styles.progress} value={calibrationProgress} max={1} />
          <button type="button" onClick={onSkipCalibration}>
            Skip
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <p role="alert">{error}</p>
          <button type="button" onClick={onStart}>
            Try again
          </button>
        </>
      )}
    </div>
  )
}
