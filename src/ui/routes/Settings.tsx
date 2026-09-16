import { useEffect, useState } from 'react'
import { useSettings } from '../settings/SettingsContext'
import styles from './Settings.module.css'

export function Settings() {
  const { settings, updateSettings } = useSettings()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  const refreshDevices = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'audioinput'))
    } catch {
      setDevices([])
    }
  }

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        if (!cancelled) setDevices(all.filter((d) => d.kind === 'audioinput'))
      })
      .catch(() => {
        if (!cancelled) setDevices([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section>
      <h1 className="mark">Settings</h1>
      <p>These apply across the tuner and both decks.</p>

      <div className={styles.grid}>
        <label className={styles.field}>
          A4 reference (Hz)
          <input
            type="number"
            min={415}
            max={466}
            value={settings.a4Hz}
            onChange={(e) => updateSettings({ a4Hz: Number(e.target.value) })}
          />
        </label>

        <div className={styles.field}>
          <span>Input device</span>
          <div className={styles.inline}>
            <select
              value={settings.inputDeviceId ?? ''}
              onChange={(e) => updateSettings({ inputDeviceId: e.target.value || null })}
            >
              <option value="">System default</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone (${d.deviceId.slice(0, 6)})`}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void refreshDevices()}>
              Refresh
            </button>
          </div>
          <p className={styles.hint}>
            Device names only appear after you&apos;ve granted microphone access once (e.g. on the
            Tuner). A built-in or wired mic is recommended over Bluetooth, which drops to a
            lower-quality profile while recording.
          </p>
        </div>

        <label className={styles.field}>
          Sensitivity (gate margin, dB): {settings.gateMarginDb}
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={settings.gateMarginDb}
            onChange={(e) => updateSettings({ gateMarginDb: Number(e.target.value) })}
          />
        </label>

        <label className={styles.field}>
          Clarity threshold: {settings.clarityThreshold.toFixed(2)}
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.01}
            value={settings.clarityThreshold}
            onChange={(e) => updateSettings({ clarityThreshold: Number(e.target.value) })}
          />
        </label>

        <fieldset className={styles.field}>
          <legend>Stretch note preference (scale positions)</legend>
          <label>
            <input
              type="radio"
              checked={settings.stretchPreference === 'pinky'}
              onChange={() => updateSettings({ stretchPreference: 'pinky' })}
            />
            Pinky
          </label>
          <label>
            <input
              type="radio"
              checked={settings.stretchPreference === 'index'}
              onChange={() => updateSettings({ stretchPreference: 'index' })}
            />
            Index
          </label>
        </fieldset>

        <fieldset className={styles.field}>
          <legend>Accidentals</legend>
          <label>
            <input
              type="radio"
              checked={!settings.preferFlats}
              onChange={() => updateSettings({ preferFlats: false })}
            />
            Sharps
          </label>
          <label>
            <input
              type="radio"
              checked={settings.preferFlats}
              onChange={() => updateSettings({ preferFlats: true })}
            />
            Flats
          </label>
        </fieldset>

        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={settings.hideLiveReadout}
            onChange={(e) => updateSettings({ hideLiveReadout: e.target.checked })}
          />
          Hide live readout on exercise screens (harder)
        </label>
      </div>
    </section>
  )
}
