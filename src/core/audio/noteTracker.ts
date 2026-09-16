import { centsOffset, hzToMidi, type Midi } from '../theory/pitch'
import { rmsToDb, type PitchReading } from './pitchDetector'

export type NoteEvent =
  | { type: 'onset'; time: number; midi: Midi; cents: number; confidence: number }
  | { type: 'offset'; time: number }

export interface TrackerConfig {
  /** Absolute floor for the silence gate, in dBFS. The gate never goes below this. */
  gateFloorDb: number
  /** How far above the calibrated noise floor the gate sits, in dB. */
  gateMarginDb: number
  /** How long to ignore readings after RMS crosses the gate, to skip the noisy pick attack. */
  attackIgnoreMs: number
  /** Consecutive matching valid readings required (after the ignore window) to confirm an onset. */
  attackStabilizeCount: number
  /** Give up on an attack that hasn't stabilized within this long. */
  attackTimeoutMs: number
  /** How long RMS must stay below the gate before an offset is emitted. */
  offsetSilenceMs: number
  /** An RMS increase at least this large (dB) within `repluckWindowMs` is treated as a re-pick. */
  repluckJumpDb: number
  /** Trailing window used to detect a re-pluck RMS jump. */
  repluckWindowMs: number
  /** Rolling median window size (in valid readings) used to smooth the pitch reading. */
  medianWindowSize: number
  /** A4 reference frequency in Hz, used to convert readings to MIDI. */
  a4Hz: number
}

export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  gateFloorDb: -50,
  gateMarginDb: 10,
  attackIgnoreMs: 50,
  attackStabilizeCount: 4,
  attackTimeoutMs: 400,
  offsetSilenceMs: 60,
  repluckJumpDb: 6,
  repluckWindowMs: 30,
  medianWindowSize: 5,
  a4Hz: 440,
}

/** The silence gate for a calibrated noise floor: max(gateFloorDb, noiseFloorDb + gateMarginDb). Exported so the UI can display the same gate the tracker uses. */
export function computeGateDb(
  noiseFloorDb: number,
  config: Pick<TrackerConfig, 'gateFloorDb' | 'gateMarginDb'> = DEFAULT_TRACKER_CONFIG,
): number {
  return Math.max(config.gateFloorDb, noiseFloorDb + config.gateMarginDb)
}

interface SilentState {
  kind: 'silent'
}

interface AttackCandidate {
  midi: Midi
  cents: number[]
  clarities: number[]
}

interface AttackState {
  kind: 'attack'
  startTime: number
  ignoreUntil: number
  candidate: AttackCandidate | null
}

interface SustainState {
  kind: 'sustain'
  midi: Midi
  belowGateSince: number | null
  changeCandidate: AttackCandidate | null
}

type TrackerState = SilentState | AttackState | SustainState

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Turns a stream of PitchReadings into onset/offset NoteEvents, per PLAN.md
 * section 6.1: SILENT -> ATTACK -> SUSTAIN, with a re-pluck RMS-jump shortcut
 * from SUSTAIN back into ATTACK, and a direct in-SUSTAIN pitch-change path
 * for legato (hammer-ons, pull-offs, slides), which have no fresh attack
 * transient to wait out.
 */
export class NoteTracker {
  private config: TrackerConfig
  private state: TrackerState = { kind: 'silent' }
  private noiseFloorDb = -Infinity
  private medianBuffer: number[] = []
  private rmsHistory: { time: number; db: number }[] = []

  constructor(config: TrackerConfig = DEFAULT_TRACKER_CONFIG) {
    this.config = config
  }

  setConfig(config: Partial<TrackerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /** Set the calibrated noise floor (dBFS) measured during a "stay quiet" calibration step. */
  setNoiseFloorDb(db: number): void {
    this.noiseFloorDb = db
  }

  private gateDb(): number {
    return computeGateDb(this.noiseFloorDb, this.config)
  }

  private pushRmsHistory(time: number, db: number): void {
    this.rmsHistory.push({ time, db })
    const cutoff = time - this.config.repluckWindowMs / 1000
    while (this.rmsHistory.length > 0 && this.rmsHistory[0].time < cutoff) {
      this.rmsHistory.shift()
    }
  }

  private detectRepluckJump(time: number, currentDb: number): boolean {
    const cutoff = time - this.config.repluckWindowMs / 1000
    let minDb = Infinity
    for (const entry of this.rmsHistory) {
      if (entry.time >= cutoff) minDb = Math.min(minDb, entry.db)
    }
    return currentDb - minDb >= this.config.repluckJumpDb
  }

  private smoothedMidiFloat(reading: PitchReading): number | null {
    if (reading.hz === null) return null
    const midiFloat = hzToMidi(reading.hz, this.config.a4Hz)
    this.medianBuffer.push(midiFloat)
    if (this.medianBuffer.length > this.config.medianWindowSize) this.medianBuffer.shift()
    return median(this.medianBuffer)
  }

  private enterAttack(startTime: number): AttackState {
    return {
      kind: 'attack',
      startTime,
      ignoreUntil: startTime + this.config.attackIgnoreMs / 1000,
      candidate: null,
    }
  }

  /** Process one PitchReading. Returns 0-2 NoteEvents (an offset+onset pair is possible in one call). */
  process(reading: PitchReading): NoteEvent[] {
    const events: NoteEvent[] = []
    const rmsDb = rmsToDb(reading.rms)
    const gateDb = this.gateDb()
    const aboveGate = rmsDb >= gateDb
    const smoothed = this.smoothedMidiFloat(reading)
    const state = this.state

    switch (state.kind) {
      case 'silent': {
        if (aboveGate) this.state = this.enterAttack(reading.time)
        break
      }

      case 'attack': {
        const attack = state
        if (!aboveGate || reading.time - attack.startTime >= this.config.attackTimeoutMs / 1000) {
          this.state = { kind: 'silent' }
          break
        }
        if (reading.time < attack.ignoreUntil || smoothed === null) break

        const roundedMidi = Math.round(smoothed)
        const cents = centsOffset(smoothed, roundedMidi)
        if (attack.candidate && attack.candidate.midi === roundedMidi) {
          attack.candidate.cents.push(cents)
          attack.candidate.clarities.push(reading.clarity)
        } else {
          attack.candidate = { midi: roundedMidi, cents: [cents], clarities: [reading.clarity] }
        }

        if (attack.candidate.cents.length >= this.config.attackStabilizeCount) {
          events.push({
            type: 'onset',
            time: reading.time,
            midi: attack.candidate.midi,
            cents: mean(attack.candidate.cents),
            confidence: mean(attack.candidate.clarities),
          })
          this.state = {
            kind: 'sustain',
            midi: attack.candidate.midi,
            belowGateSince: null,
            changeCandidate: null,
          }
        }
        break
      }

      case 'sustain': {
        const sustain = state
        if (this.detectRepluckJump(reading.time, rmsDb)) {
          events.push({ type: 'offset', time: reading.time })
          this.state = this.enterAttack(reading.time)
          break
        }

        if (!aboveGate) {
          if (sustain.belowGateSince === null) {
            sustain.belowGateSince = reading.time
          } else if (reading.time - sustain.belowGateSince >= this.config.offsetSilenceMs / 1000) {
            events.push({ type: 'offset', time: reading.time })
            this.state = { kind: 'silent' }
          }
          break
        }
        sustain.belowGateSince = null

        if (smoothed === null) break
        const roundedMidi = Math.round(smoothed)
        if (roundedMidi === sustain.midi) {
          sustain.changeCandidate = null
          break
        }

        const cents = centsOffset(smoothed, roundedMidi)
        if (sustain.changeCandidate && sustain.changeCandidate.midi === roundedMidi) {
          sustain.changeCandidate.cents.push(cents)
          sustain.changeCandidate.clarities.push(reading.clarity)
        } else {
          sustain.changeCandidate = {
            midi: roundedMidi,
            cents: [cents],
            clarities: [reading.clarity],
          }
        }

        if (sustain.changeCandidate.cents.length >= this.config.attackStabilizeCount) {
          events.push({ type: 'offset', time: reading.time })
          events.push({
            type: 'onset',
            time: reading.time,
            midi: sustain.changeCandidate.midi,
            cents: mean(sustain.changeCandidate.cents),
            confidence: mean(sustain.changeCandidate.clarities),
          })
          this.state = {
            kind: 'sustain',
            midi: sustain.changeCandidate.midi,
            belowGateSince: null,
            changeCandidate: null,
          }
        }
        break
      }
    }

    this.pushRmsHistory(reading.time, rmsDb)
    return events
  }
}
