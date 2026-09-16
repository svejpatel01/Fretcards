import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioFrame } from '../../core/audio/frame'
import {
  PitchDetector,
  rmsToDb,
  type PitchDetectorConfig,
  type PitchReading,
} from '../../core/audio/pitchDetector'
import {
  DEFAULT_TRACKER_CONFIG,
  NoteTracker,
  type NoteEvent,
  type TrackerConfig,
} from '../../core/audio/noteTracker'
import { ACOUSTIC_GUITAR } from '../../core/instruments/acousticGuitar'
import type { FrameSource } from '../../adapters/frameSource'
import { MicSource } from '../../adapters/micSource'
import { loadValue, saveValue } from '../../adapters/storage'

const CALIBRATION_DURATION_SECONDS = 1
const NOISE_FLOOR_STORAGE_KEY = 'noiseFloorDb'
const WINDOW_SIZE = 2048

export type AudioEngineStatus = 'idle' | 'requesting-permission' | 'calibrating' | 'ready' | 'error'

export interface AudioEngineConfig {
  a4Hz?: number
  clarityThreshold?: number
  gateMarginDb?: number
}

export interface UseAudioEngineResult {
  status: AudioEngineStatus
  error: string | null
  /** The most recent pitch reading, for live readouts like the tuner needle or a "Hearing: G3" label. */
  reading: PitchReading | null
  /** The most recent frame's raw samples, for a waveform plot (the dev page). A fresh array per frame. */
  frameSamples: Float32Array | null
  noiseFloorDb: number | null
  /** 0..1 while status is 'calibrating'. */
  calibrationProgress: number
  start: () => Promise<void>
  stop: () => void
  /** Skip the one-time "stay quiet" calibration; falls back to the tracker's default -50dBFS gate floor. */
  skipCalibration: () => void
  /** Subscribe to onset/offset NoteEvents. Returns an unsubscribe function. */
  onNoteEvent: (callback: (event: NoteEvent) => void) => () => void
  /** Live-tune the pitch detector (the dev page's threshold sliders). */
  setDetectorConfig: (config: Partial<PitchDetectorConfig>) => void
  /** Live-tune the note tracker (the dev page's threshold sliders). */
  setTrackerConfig: (config: Partial<TrackerConfig>) => void
}

/**
 * Wires a FrameSource (mic or file) to a PitchDetector and NoteTracker, and
 * runs the one-time noise-floor calibration (PLAN.md section 6.1, point 1)
 * the first time the mic starts, storing the result so later sessions skip
 * straight to 'ready'.
 */
export function useAudioEngine(
  createSource: () => FrameSource = () => new MicSource(),
  config: AudioEngineConfig = {},
): UseAudioEngineResult {
  const [status, setStatus] = useState<AudioEngineStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState<PitchReading | null>(null)
  const [frameSamples, setFrameSamples] = useState<Float32Array | null>(null)
  const [noiseFloorDb, setNoiseFloorDb] = useState<number | null>(null)
  const [calibrationProgress, setCalibrationProgress] = useState(0)

  const frameSourceRef = useRef<FrameSource | null>(null)
  const detectorRef = useRef<PitchDetector | null>(null)
  const trackerRef = useRef<NoteTracker | null>(null)
  const listenersRef = useRef<Set<(event: NoteEvent) => void>>(new Set())
  const calibrationSamplesRef = useRef<number[]>([])
  const calibratingRef = useRef(false)

  const onNoteEvent = useCallback((callback: (event: NoteEvent) => void) => {
    listenersRef.current.add(callback)
    return () => {
      listenersRef.current.delete(callback)
    }
  }, [])

  const finishCalibration = useCallback((db: number) => {
    calibratingRef.current = false
    saveValue(NOISE_FLOOR_STORAGE_KEY, db)
    setNoiseFloorDb(db)
    trackerRef.current?.setNoiseFloorDb(db)
    setStatus('ready')
  }, [])

  const skipCalibration = useCallback(() => {
    finishCalibration(-Infinity) // uncalibrated: the tracker's gate falls back to its -50dBFS floor
  }, [finishCalibration])

  const handleFrame = useCallback(
    (frame: AudioFrame) => {
      const detector = detectorRef.current
      const tracker = trackerRef.current
      if (!detector || !tracker) return

      const pitchReading = detector.process(frame)
      setReading(pitchReading)
      setFrameSamples(frame.samples)

      if (calibratingRef.current) {
        calibrationSamplesRef.current.push(rmsToDb(pitchReading.rms))
        setCalibrationProgress(Math.min(1, frame.time / CALIBRATION_DURATION_SECONDS))
        if (frame.time >= CALIBRATION_DURATION_SECONDS) {
          const finiteSamples = calibrationSamplesRef.current.filter((db) => Number.isFinite(db))
          const avgDb =
            finiteSamples.length > 0
              ? finiteSamples.reduce((sum, db) => sum + db, 0) / finiteSamples.length
              : -60
          finishCalibration(avgDb)
        }
        return
      }

      for (const event of tracker.process(pitchReading)) {
        listenersRef.current.forEach((callback) => callback(event))
      }
    },
    [finishCalibration],
  )

  const stop = useCallback(() => {
    frameSourceRef.current?.setOnFrame(null)
    frameSourceRef.current?.stop()
    frameSourceRef.current = null
    detectorRef.current = null
    trackerRef.current = null
    calibratingRef.current = false
    setStatus('idle')
    setReading(null)
    setFrameSamples(null)
  }, [])

  const setDetectorConfig = useCallback((config: Partial<PitchDetectorConfig>) => {
    detectorRef.current?.setConfig(config)
  }, [])

  const setTrackerConfig = useCallback((config: Partial<TrackerConfig>) => {
    trackerRef.current?.setConfig(config)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setStatus('requesting-permission')
    const source = createSource()

    try {
      await source.start()
    } catch (err) {
      setStatus('error')
      setError(describeMicError(err))
      return
    }

    frameSourceRef.current = source
    detectorRef.current = new PitchDetector(WINDOW_SIZE, {
      clarityThreshold: config.clarityThreshold ?? 0.9,
      detectorRange: ACOUSTIC_GUITAR.detectorRange,
    })
    trackerRef.current = new NoteTracker({
      ...DEFAULT_TRACKER_CONFIG,
      a4Hz: config.a4Hz ?? DEFAULT_TRACKER_CONFIG.a4Hz,
      gateMarginDb: config.gateMarginDb ?? DEFAULT_TRACKER_CONFIG.gateMarginDb,
    })
    source.setOnFrame(handleFrame)

    const storedNoiseFloor = loadValue<number | null>(NOISE_FLOOR_STORAGE_KEY, null)
    if (storedNoiseFloor !== null) {
      setNoiseFloorDb(storedNoiseFloor)
      trackerRef.current.setNoiseFloorDb(storedNoiseFloor)
      setStatus('ready')
    } else {
      calibratingRef.current = true
      calibrationSamplesRef.current = []
      setCalibrationProgress(0)
      setStatus('calibrating')
    }
  }, [createSource, handleFrame, config])

  useEffect(() => stop, [stop])

  return {
    status,
    error,
    reading,
    frameSamples,
    noiseFloorDb,
    calibrationProgress,
    start,
    stop,
    skipCalibration,
    onNoteEvent,
    setDetectorConfig,
    setTrackerConfig,
  }
}

function describeMicError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') {
      return 'Microphone access was denied. Allow microphone access in your browser settings and reload.'
    }
    if (err.name === 'NotFoundError') {
      return 'No microphone was found. Connect a microphone and reload.'
    }
    if (err.name === 'NotReadableError') {
      return 'The microphone could not be started — it may be in use by another app.'
    }
  }
  return 'Could not access the microphone.'
}
