import { describe, expect, it } from 'vitest'
import { midiToHz } from '../../../src/core/theory/pitch'
import { NoteTracker, type NoteEvent } from '../../../src/core/audio/noteTracker'
import type { PitchReading } from '../../../src/core/audio/pitchDetector'

const DT = 0.02 // 20ms between frames, in the middle of the plan's 16-20ms range
const LOUD_DB = -20
const QUIET_DB = -60

function dbToRms(db: number): number {
  return 10 ** (db / 20)
}

function reading(
  time: number,
  opts: { midi?: number; clarity?: number; db?: number } = {},
): PitchReading {
  const { midi, clarity = 0.95, db = midi !== undefined ? LOUD_DB : QUIET_DB } = opts
  return {
    time,
    hz: midi === undefined ? null : midiToHz(midi),
    clarity,
    rms: dbToRms(db),
  }
}

/** Feeds `count` frames of the same reading spec, `DT` seconds apart, starting at `startTime`. */
function feed(
  tracker: NoteTracker,
  startTime: number,
  count: number,
  opts: { midi?: number; clarity?: number; db?: number } = {},
): { events: NoteEvent[]; endTime: number } {
  const events: NoteEvent[] = []
  let time = startTime
  for (let i = 0; i < count; i++) {
    events.push(...tracker.process(reading(time, opts)))
    time += DT
  }
  return { events, endTime: time }
}

describe('NoteTracker: silence', () => {
  it('stays silent and emits nothing for quiet, unpitched frames', () => {
    const tracker = new NoteTracker()
    const { events } = feed(tracker, 0, 20)
    expect(events).toEqual([])
  })
})

describe('NoteTracker: clean onset and offset', () => {
  it('emits one onset after the attack stabilizes, then one offset after the release', () => {
    const tracker = new NoteTracker()
    const events: NoteEvent[] = []

    // Silence, then a clean, steady E4 (midi 64) pluck.
    events.push(...feed(tracker, 0, 1, {}).events) // t=0.00 silent
    const { events: e1, endTime } = feed(tracker, 0.02, 30, { midi: 64 }) // sustain well past onset
    events.push(...e1)

    expect(events).toEqual([
      {
        type: 'onset',
        time: expect.closeTo(0.14, 9),
        midi: 64,
        cents: expect.closeTo(0, 6),
        confidence: expect.closeTo(0.95, 6),
      },
    ])

    // Release: go quiet for long enough to cross the 60ms offset-silence threshold.
    const { events: e2 } = feed(tracker, endTime, 10, {})
    expect(e2).toEqual([{ type: 'offset', time: expect.closeTo(endTime + 0.06, 9) }])
  })

  it('does not emit an onset if RMS drops before the attack stabilizes (a scrape or knock)', () => {
    const tracker = new NoteTracker()
    // Only 2 loud frames (less than the attackIgnoreMs window), then silence.
    const { events: e1 } = feed(tracker, 0, 2, { midi: 64 })
    const { events: e2 } = feed(tracker, 0.04, 10, {})
    expect([...e1, ...e2]).toEqual([])
  })
})

describe('NoteTracker: attack that never stabilizes', () => {
  it('drops the attack after the timeout if the pitch never settles, with no events', () => {
    const tracker = new NoteTracker()
    const events: NoteEvent[] = []
    let time = 0
    // Alternate between two pitches every frame, loud throughout, for >400ms.
    for (let i = 0; i < 30; i++) {
      events.push(...tracker.process(reading(time, { midi: i % 2 === 0 ? 60 : 62 })))
      time += DT
    }
    expect(events).toEqual([])
  })

  it('drops the attack after the timeout if no reading is ever pitched (an unpitched noise burst)', () => {
    const tracker = new NoteTracker()
    const events: NoteEvent[] = []
    let time = 0
    // Loud but unpitched (e.g. clarity never reaches threshold, so hz is null) for >400ms.
    for (let i = 0; i < 30; i++) {
      events.push(...tracker.process(reading(time, { db: LOUD_DB })))
      time += DT
    }
    expect(events).toEqual([])
  })
})

describe('NoteTracker: repeated note', () => {
  it('a full silence gap between two identical plucks yields two onsets', () => {
    const tracker = new NoteTracker()
    const events: NoteEvent[] = []

    const { endTime: t1 } = feed(tracker, 0, 1, {})
    const { events: e1, endTime: t2 } = feed(tracker, t1 + DT, 10, { midi: 64 })
    const { events: e2, endTime: t3 } = feed(tracker, t2, 10, {}) // silence: release
    const { events: e3 } = feed(tracker, t3, 10, { midi: 64 }) // second pluck

    events.push(...e1, ...e2, ...e3)
    const onsets = events.filter((e) => e.type === 'onset')
    expect(onsets).toHaveLength(2)
    expect(onsets.every((e) => e.type === 'onset' && e.midi === 64)).toBe(true)
  })

  it('a re-pluck (RMS jump within 30ms while sustaining) emits offset then a new onset', () => {
    const tracker = new NoteTracker()
    const events: NoteEvent[] = []

    const { endTime: t1 } = feed(tracker, 0, 1, {})
    const { events: e1, endTime: t2 } = feed(tracker, t1 + DT, 10, { midi: 64, db: -20 })
    events.push(...e1)
    expect(events.filter((e) => e.type === 'onset')).toHaveLength(1)

    // A fresh pick: RMS jumps 10dB (>= the 6dB threshold) within one frame.
    const { events: e2 } = feed(tracker, t2, 20, { midi: 64, db: -10 })
    events.push(...e2)

    const onsets = events.filter((e) => e.type === 'onset')
    const offsets = events.filter((e) => e.type === 'offset')
    expect(onsets).toHaveLength(2)
    expect(offsets.length).toBeGreaterThanOrEqual(1)
    // The offset from the re-pluck must come before the second onset.
    const secondOnsetIndex = events.indexOf(onsets[1])
    const repluckOffsetIndex = events.findIndex((e) => e.type === 'offset')
    expect(repluckOffsetIndex).toBeGreaterThanOrEqual(0)
    expect(repluckOffsetIndex).toBeLessThan(secondOnsetIndex)
  })
})

describe('NoteTracker: legato pitch change within sustain', () => {
  it('emits offset then onset for a hammer-on/slide, without an RMS jump', () => {
    const tracker = new NoteTracker()
    const events: NoteEvent[] = []

    const { endTime: t1 } = feed(tracker, 0, 1, {})
    const { events: e1, endTime: t2 } = feed(tracker, t1 + DT, 15, { midi: 64 }) // settle on E4
    events.push(...e1)
    expect(events).toEqual([expect.objectContaining({ type: 'onset', midi: 64 })])

    // Slide up to F#4 (midi 66), staying loud the whole time (no RMS jump).
    const { events: e2 } = feed(tracker, t2, 15, { midi: 66 })
    events.push(...e2)

    const offsetIndex = events.findIndex((e) => e.type === 'offset')
    const secondOnsetIndex = events.findIndex((e) => e.type === 'onset' && e.midi === 66)
    expect(offsetIndex).toBeGreaterThan(0)
    expect(secondOnsetIndex).toBe(offsetIndex + 1) // offset immediately followed by the new onset
    expect(events.filter((e) => e.type === 'onset')).toHaveLength(2)
    expect(events.filter((e) => e.type === 'offset')).toHaveLength(1)
  })
})

describe('NoteTracker: noise floor calibration', () => {
  it('raises the gate so a quiet room-noise level no longer triggers an attack', () => {
    const tracker = new NoteTracker()
    tracker.setNoiseFloorDb(-30) // gate becomes max(-50, -30+10) = -20dB

    // -25dB is below the calibrated gate (though above the uncalibrated -50dB default).
    const { events } = feed(tracker, 0, 30, { midi: 64, db: -25 })
    expect(events).toEqual([])
  })

  it('still triggers an attack once RMS clears the calibrated gate', () => {
    const tracker = new NoteTracker()
    tracker.setNoiseFloorDb(-30) // gate becomes -20dB

    const { events } = feed(tracker, 0, 30, { midi: 64, db: -15 })
    expect(events.filter((e) => e.type === 'onset')).toHaveLength(1)
  })
})
