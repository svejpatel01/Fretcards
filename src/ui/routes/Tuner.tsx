import { useCallback } from 'react'
import { centsOffset, hzToMidi, noteName } from '../../core/theory/pitch'
import { computeGateDb } from '../../core/audio/noteTracker'
import { MicSource } from '../../adapters/micSource'
import { useAudioEngine } from '../hooks/useAudioEngine'
import { useSettings } from '../settings/SettingsContext'
import { MicPermissionGate } from '../components/MicPermissionGate'
import { LevelMeter } from '../components/LevelMeter'
import { TunerDial } from '../components/TunerDial'
import styles from './Tuner.module.css'

export function Tuner() {
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
  const { reading } = engine

  const midiFloat = reading?.hz != null ? hzToMidi(reading.hz, settings.a4Hz) : null
  const midi = midiFloat !== null ? Math.round(midiFloat) : null
  const cents = midiFloat !== null && midi !== null ? centsOffset(midiFloat, midi) : null
  const displayName = midi !== null ? noteName(midi, { preferFlats: settings.preferFlats }) : null
  const gateDb =
    engine.noiseFloorDb !== null
      ? computeGateDb(engine.noiseFloorDb, {
          gateFloorDb: -50,
          gateMarginDb: settings.gateMarginDb,
        })
      : undefined

  return (
    <section>
      <h1 className="mark">Tuner</h1>
      <p>
        Play a single open string and hold it. The needle shows how far off you are in cents; a
        string 50¢ flat will grade as the wrong note in the decks, so it&apos;s worth tuning up
        first.
      </p>

      <MicPermissionGate
        status={engine.status}
        error={engine.error}
        calibrationProgress={engine.calibrationProgress}
        onStart={() => void engine.start()}
        onSkipCalibration={engine.skipCalibration}
      >
        <div className={styles.tuner}>
          <TunerDial noteName={displayName} cents={cents} />
          <LevelMeter rms={reading?.rms ?? 0} gateDb={gateDb} />
          <button type="button" onClick={engine.stop}>
            Stop
          </button>
        </div>
      </MicPermissionGate>
    </section>
  )
}
