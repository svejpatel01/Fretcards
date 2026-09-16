import { useCallback } from 'react'
import { computeGateDb } from '../../core/audio/noteTracker'
import { MicSource } from '../../adapters/micSource'
import { useAudioEngine } from '../hooks/useAudioEngine'
import { useSettings } from '../settings/SettingsContext'
import { MicPermissionGate } from '../components/MicPermissionGate'
import { LevelMeter } from '../components/LevelMeter'
import { Waveform } from '../components/Waveform'
import styles from './HowItWorks.module.css'

export function HowItWorks() {
  const { settings } = useSettings()
  const createSource = useCallback(
    () => new MicSource(settings.inputDeviceId),
    [settings.inputDeviceId],
  )
  const engine = useAudioEngine(createSource, {
    a4Hz: settings.a4Hz,
    clarityThreshold: settings.clarityThreshold,
    gateMarginDb: settings.gateMarginDb,
  })
  const gateDb =
    engine.noiseFloorDb !== null
      ? computeGateDb(engine.noiseFloorDb, {
          gateFloorDb: -50,
          gateMarginDb: settings.gateMarginDb,
        })
      : undefined

  return (
    <section>
      <h1 className="mark">How it works</h1>
      <p>
        Everything here runs in your browser. The microphone signal never leaves your device —
        there's no server, no upload, no account. Here's the pipeline that turns your playing into a
        graded flashcard.
      </p>

      <ol className={styles.pipeline}>
        <li>
          <strong>Mic.</strong> <code>getUserMedia</code> opens the microphone with browser voice
          processing (echo cancellation, noise suppression, auto-gain) turned off — those are built
          for speech and treat a sustained guitar note as noise to suppress.
        </li>
        <li>
          <strong>Frames.</strong> The signal is read in 2048-sample windows (about 43ms), roughly
          every 16-20ms, via an <code>AnalyserNode</code> polled on{' '}
          <code>requestAnimationFrame</code>.
        </li>
        <li>
          <strong>McLeod pitch.</strong> Each window goes through the McLeod Pitch Method (via the{' '}
          <code>pitchy</code> library), which returns a frequency and a clarity score — how
          confident the algorithm is that the frequency it found is real, not noise.
        </li>
        <li>
          <strong>Note tracker.</strong> A state machine turns the stream of readings into discrete
          onset/offset events: it waits out the noisy first ~50ms of a pluck, requires a few
          consecutive matching readings before committing to a note, and separately detects re-picks
          (a sudden volume jump) and legato pitch changes (hammer-ons, slides).
        </li>
        <li>
          <strong>Grader.</strong> Each deck grades onsets its own way — the note finder checks
          pitch class (or an exact fret on a named string); the scale deck walks an expected
          sequence, classifying each onset as correct, a re-pick, a skip, a wrong octave, or a wrong
          note.
        </li>
      </ol>

      <h2>Try it live</h2>
      <p>Play a note and watch the raw signal move through the first few stages of the pipeline.</p>

      <MicPermissionGate
        status={engine.status}
        error={engine.error}
        calibrationProgress={engine.calibrationProgress}
        onStart={() => void engine.start()}
        onSkipCalibration={engine.skipCalibration}
      >
        <div className={styles.demo}>
          <Waveform samples={engine.frameSamples} />
          <dl className={styles.readout}>
            <dt>Hz</dt>
            <dd>{engine.reading?.hz?.toFixed(2) ?? '—'}</dd>
            <dt>Clarity</dt>
            <dd>{engine.reading?.clarity.toFixed(3) ?? '—'}</dd>
          </dl>
          <LevelMeter rms={engine.reading?.rms ?? 0} gateDb={gateDb} />
          <button type="button" onClick={engine.stop}>
            Stop
          </button>
        </div>
      </MicPermissionGate>

      <p className={styles.note}>
        One limitation worth naming: audio alone can't tell which string you used — the same pitch
        exists in several places on the neck. The scale deck's diagram tells you where to play; the
        app only verifies what it heard.
      </p>
    </section>
  )
}
