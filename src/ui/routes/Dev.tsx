import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PITCH_DETECTOR_CONFIG } from '../../core/audio/pitchDetector'
import { DEFAULT_TRACKER_CONFIG, computeGateDb, type NoteEvent } from '../../core/audio/noteTracker'
import { rmsToDb } from '../../core/audio/pitchDetector'
import type { FrameSource } from '../../adapters/frameSource'
import { MicSource } from '../../adapters/micSource'
import { FileSource } from '../../adapters/fileSource'
import { useAudioEngine } from '../hooks/useAudioEngine'
import { MicPermissionGate } from '../components/MicPermissionGate'
import { LevelMeter } from '../components/LevelMeter'
import { RoutePlaceholder } from './RoutePlaceholder'
import styles from './Dev.module.css'

const WAVEFORM_COLOR = '#2f8c86' // --color-abalone

export function Dev() {
  const [searchParams] = useSearchParams()
  if (!searchParams.has('debug')) {
    return (
      <RoutePlaceholder
        title="Dev tools"
        description="Add ?debug to the URL to enable this page."
      />
    )
  }
  return <DevTools />
}

function DevTools() {
  const [mode, setMode] = useState<'mic' | 'file'>('mic')
  const [file, setFile] = useState<File | null>(null)
  const [events, setEvents] = useState<NoteEvent[]>([])

  const [clarityThreshold, setClarityThreshold] = useState(
    DEFAULT_PITCH_DETECTOR_CONFIG.clarityThreshold,
  )
  const [gateMarginDb, setGateMarginDb] = useState(DEFAULT_TRACKER_CONFIG.gateMarginDb)
  const [attackStabilizeCount, setAttackStabilizeCount] = useState(
    DEFAULT_TRACKER_CONFIG.attackStabilizeCount,
  )
  const [medianWindowSize, setMedianWindowSize] = useState(DEFAULT_TRACKER_CONFIG.medianWindowSize)

  const createSource = useCallback((): FrameSource => {
    if (mode === 'file' && file) return new FileSource(file)
    return new MicSource()
  }, [mode, file])

  const engine = useAudioEngine(createSource)
  const { onNoteEvent, frameSamples } = engine
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(
    () =>
      onNoteEvent((event) => {
        setEvents((prev) => [...prev.slice(-19), event])
      }),
    [onNoteEvent],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const samples = frameSamples
    if (!canvas || !samples) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath()
    for (let i = 0; i < samples.length; i++) {
      const x = (i / samples.length) * canvas.width
      const y = canvas.height / 2 - samples[i] * (canvas.height / 2)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = WAVEFORM_COLOR
    ctx.lineWidth = 1
    ctx.stroke()
  }, [frameSamples])

  const gateDb =
    engine.noiseFloorDb !== null
      ? computeGateDb(engine.noiseFloorDb, {
          gateFloorDb: DEFAULT_TRACKER_CONFIG.gateFloorDb,
          gateMarginDb,
        })
      : undefined

  return (
    <section>
      <h1>Dev tools</h1>
      <p>Mic or uploaded WAV as input. Live thresholds for tuning against a real guitar.</p>

      <div className={styles.sourcePicker}>
        <label>
          <input type="radio" checked={mode === 'mic'} onChange={() => setMode('mic')} /> Microphone
        </label>
        <label>
          <input type="radio" checked={mode === 'file'} onChange={() => setMode('file')} /> Uploaded
          file
        </label>
        {mode === 'file' && (
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        )}
      </div>

      <MicPermissionGate
        status={engine.status}
        error={engine.error}
        calibrationProgress={engine.calibrationProgress}
        onStart={() => void engine.start()}
        onSkipCalibration={engine.skipCalibration}
      >
        <div className={styles.panels}>
          <div>
            <h2>Waveform</h2>
            <canvas ref={canvasRef} width={512} height={128} className={styles.waveform} />

            <h2>Reading</h2>
            <dl className={styles.readout}>
              <dt>Hz</dt>
              <dd>{engine.reading?.hz?.toFixed(2) ?? '—'}</dd>
              <dt>Clarity</dt>
              <dd>{engine.reading?.clarity.toFixed(3) ?? '—'}</dd>
              <dt>RMS (dB)</dt>
              <dd>{engine.reading ? rmsToDb(engine.reading.rms).toFixed(1) : '—'}</dd>
              <dt>Noise floor (dB)</dt>
              <dd>
                {engine.noiseFloorDb !== null && Number.isFinite(engine.noiseFloorDb)
                  ? engine.noiseFloorDb.toFixed(1)
                  : 'uncalibrated'}
              </dd>
            </dl>
            <LevelMeter rms={engine.reading?.rms ?? 0} gateDb={gateDb} />
          </div>

          <div>
            <h2>Note events</h2>
            <ul className={styles.eventLog}>
              {events.length === 0 && <li>No events yet.</li>}
              {events.map((event, i) => (
                <li key={i}>
                  {event.time.toFixed(3)}s — {event.type}
                  {event.type === 'onset' &&
                    ` midi=${event.midi} cents=${event.cents.toFixed(1)} conf=${event.confidence.toFixed(2)}`}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2>TrackerConfig sliders</h2>
            <label className={styles.slider}>
              Clarity threshold: {clarityThreshold.toFixed(2)}
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.01}
                value={clarityThreshold}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setClarityThreshold(value)
                  engine.setDetectorConfig({ clarityThreshold: value })
                }}
              />
            </label>
            <label className={styles.slider}>
              Gate margin (dB): {gateMarginDb}
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={gateMarginDb}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setGateMarginDb(value)
                  engine.setTrackerConfig({ gateMarginDb: value })
                }}
              />
            </label>
            <label className={styles.slider}>
              Attack stabilize count: {attackStabilizeCount}
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={attackStabilizeCount}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setAttackStabilizeCount(value)
                  engine.setTrackerConfig({ attackStabilizeCount: value })
                }}
              />
            </label>
            <label className={styles.slider}>
              Median window size: {medianWindowSize}
              <input
                type="range"
                min={1}
                max={11}
                step={2}
                value={medianWindowSize}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setMedianWindowSize(value)
                  engine.setTrackerConfig({ medianWindowSize: value })
                }}
              />
            </label>
          </div>
        </div>
      </MicPermissionGate>
    </section>
  )
}
