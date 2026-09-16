export interface Settings {
  a4Hz: number
  /** 0..1; readings below this clarity are treated as unpitched. */
  clarityThreshold: number
  /** How far above the calibrated noise floor the silence gate sits, in dB ("sensitivity"). */
  gateMarginDb: number
  stretchPreference: 'pinky' | 'index'
  preferFlats: boolean
  hideLiveReadout: boolean
  /** MediaDeviceInfo.deviceId of the preferred mic input, or null for the system default. */
  inputDeviceId: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  a4Hz: 440,
  clarityThreshold: 0.9,
  gateMarginDb: 10,
  stretchPreference: 'pinky',
  preferFlats: false,
  hideLiveReadout: false,
  inputDeviceId: null,
}
