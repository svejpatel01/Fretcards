import { describe, expect, it } from 'vitest'
import { ACOUSTIC_GUITAR } from '../../../src/core/instruments/acousticGuitar'
import { fretWindowPositionSystem } from '../../../src/core/fretboard/positions/fretWindow'
import {
  buildScaleSequence,
  checkScalePause,
  checkScaleSessionPause,
  createScaleAttempt,
  createScaleSession,
  describeMistake,
  processScaleEvent,
  processScaleOnset,
} from '../../../src/core/exercises/scaleDeck'
import type { NoteEvent } from '../../../src/core/audio/noteTracker'

describe('buildScaleSequence', () => {
  it('goes up then back down without repeating the top note, using real G major position 2 data', () => {
    const ascending = fretWindowPositionSystem.majorScaleShape(ACOUSTIC_GUITAR, 7, 2)
    const sequence = buildScaleSequence(ACOUSTIC_GUITAR, ascending)
    expect(sequence).toHaveLength(ascending.length * 2 - 1)
    // Ascending half matches the shape; descending half is the reverse, minus the repeated top note.
    const ascendingMidis = ascending.map((loc) => ACOUSTIC_GUITAR.strings[loc.string] + loc.fret)
    expect(sequence.slice(0, ascending.length)).toEqual(ascendingMidis)
    expect(sequence.slice(ascending.length)).toEqual([...ascendingMidis].slice(0, -1).reverse())
    // Top note appears exactly once.
    expect(sequence.filter((m) => m === ascendingMidis[ascendingMidis.length - 1])).toHaveLength(1)
  })

  it('handles a two-note shape without duplicating anything', () => {
    const sequence = buildScaleSequence(ACOUSTIC_GUITAR, [
      { string: 0, fret: 0 },
      { string: 0, fret: 2 },
    ])
    expect(sequence).toEqual([40, 42, 40])
  })
})

describe('processScaleOnset: classification', () => {
  const expected = [60, 62, 64, 65, 67] // C D E F G

  it('advances on a correct onset', () => {
    let state = createScaleAttempt(expected, 'test')
    state = processScaleOnset(state, 1.0, 60)
    expect(state.index).toBe(1)
    expect(state.status).toBe('inProgress')
    expect(state.startTime).toBe(1.0)
  })

  it('finishes when the last note is matched', () => {
    let state = createScaleAttempt(expected, 'test')
    for (let i = 0; i < expected.length; i++) {
      state = processScaleOnset(state, i + 1, expected[i])
    }
    expect(state.status).toBe('finished')
    expect(state.index).toBe(expected.length)
    expect(state.mistakes).toEqual([])
  })

  it('ignores a re-pick of the note just played', () => {
    let state = createScaleAttempt(expected, 'test')
    state = processScaleOnset(state, 1.0, 60) // correct, index -> 1
    state = processScaleOnset(state, 1.2, 60) // re-pick of expected[0]
    expect(state.index).toBe(1)
    expect(state.mistakes).toEqual([])
    expect(state.status).toBe('inProgress')
  })

  it('detects a skipped note and reports it, then continues from i+2 in practice mode', () => {
    let state = createScaleAttempt(expected, 'practice')
    state = processScaleOnset(state, 1.0, 60) // correct, index -> 1
    state = processScaleOnset(state, 1.3, 64) // skipped expected[1]=62, matches expected[2]=64
    expect(state.index).toBe(3)
    expect(state.mistakes).toEqual([{ index: 1, kind: 'skipped', expectedMidi: 62, heardMidi: 64 }])
    expect(state.status).toBe('inProgress')
  })

  it('detects wrong octave (same pitch class, different octave)', () => {
    let state = createScaleAttempt(expected, 'practice')
    state = processScaleOnset(state, 1.0, 72) // C an octave up from expected[0]=60
    expect(state.mistakes).toEqual([
      { index: 0, kind: 'wrongOctave', expectedMidi: 60, heardMidi: 72 },
    ])
    expect(state.index).toBe(0) // does not advance
  })

  it('detects a plain wrong note', () => {
    let state = createScaleAttempt(expected, 'practice')
    state = processScaleOnset(state, 1.0, 61) // C# — not expected[0], not a re-pick, not a skip, not the same pitch class
    expect(state.mistakes).toEqual([
      { index: 0, kind: 'wrongNote', expectedMidi: 60, heardMidi: 61 },
    ])
    expect(state.index).toBe(0)
  })
})

describe('processScaleOnset: test vs practice mode', () => {
  const expected = [60, 62, 64]

  it('test mode: the first mistake ends the attempt', () => {
    let state = createScaleAttempt(expected, 'test')
    state = processScaleOnset(state, 1.0, 61) // wrong note
    expect(state.status).toBe('failed')
    expect(state.mistakes).toHaveLength(1)
  })

  it('test mode: a skip also ends the attempt', () => {
    let state = createScaleAttempt(expected, 'test')
    state = processScaleOnset(state, 1.0, 64) // skips straight to expected[2]
    expect(state.status).toBe('failed')
  })

  it('practice mode: waits at the same index until the right note arrives, recording each miss', () => {
    let state = createScaleAttempt(expected, 'practice')
    state = processScaleOnset(state, 1.0, 61) // wrong
    state = processScaleOnset(state, 1.2, 63) // wrong again
    expect(state.index).toBe(0)
    expect(state.mistakes).toHaveLength(2)
    expect(state.status).toBe('inProgress')
    state = processScaleOnset(state, 1.4, 60) // finally correct
    expect(state.index).toBe(1)
  })

  it('further onsets are ignored once an attempt has finished or failed', () => {
    let state = createScaleAttempt(expected, 'test')
    state = processScaleOnset(state, 1.0, 61) // fails
    const failedState = state
    state = processScaleOnset(state, 2.0, 60)
    expect(state).toEqual(failedState)
  })
})

describe('checkScalePause', () => {
  const expected = [60, 62, 64]

  it('pauses after 8s of silence mid-attempt', () => {
    let state = createScaleAttempt(expected, 'practice')
    state = processScaleOnset(state, 1.0, 60) // starts, lastEventTime=1.0
    state = checkScalePause(state, 9.5) // 8.5s later
    expect(state.status).toBe('paused')
  })

  it('does not pause before 8s', () => {
    let state = createScaleAttempt(expected, 'practice')
    state = processScaleOnset(state, 1.0, 60)
    state = checkScalePause(state, 8.5) // 7.5s later
    expect(state.status).toBe('inProgress')
  })

  it('does nothing before the attempt has started', () => {
    const state = createScaleAttempt(expected, 'practice')
    expect(checkScalePause(state, 100).status).toBe('waitingForStart')
  })

  it('resumes to inProgress once a new onset arrives after a pause', () => {
    let state = createScaleAttempt(expected, 'practice')
    state = processScaleOnset(state, 1.0, 60)
    state = checkScalePause(state, 9.5)
    expect(state.status).toBe('paused')
    state = processScaleOnset(state, 9.6, 62)
    expect(state.status).toBe('inProgress')
    expect(state.index).toBe(2)
  })
})

describe('ScaleSession: card-shown guard and startTime semantics', () => {
  const expected = [60, 62, 64]

  it('ignores onsets within 300ms of the card appearing', () => {
    let session = createScaleSession(expected, 'test', 10.0)
    const early: NoteEvent = { type: 'onset', time: 10.2, midi: 60, cents: 0, confidence: 0.9 }
    session = processScaleEvent(session, early)
    expect(session.attempt.index).toBe(0)
    expect(session.attempt.status).toBe('waitingForStart')
  })

  it("the attempt's startTime is the first onset's time, not the card-shown time", () => {
    let session = createScaleSession(expected, 'test', 10.0)
    const onset: NoteEvent = { type: 'onset', time: 10.35, midi: 60, cents: 0, confidence: 0.9 }
    session = processScaleEvent(session, onset)
    expect(session.attempt.startTime).toBe(10.35)
  })

  it('ignores offset events for grading purposes', () => {
    let session = createScaleSession(expected, 'test', 10.0)
    session = processScaleEvent(session, { type: 'offset', time: 10.5 })
    expect(session.attempt.status).toBe('waitingForStart')
  })

  it('checkScaleSessionPause delegates to the attempt', () => {
    let session = createScaleSession(expected, 'practice', 0)
    session = processScaleEvent(session, {
      type: 'onset',
      time: 1.0,
      midi: 60,
      cents: 0,
      confidence: 0.9,
    })
    session = checkScaleSessionPause(session, 9.5)
    expect(session.attempt.status).toBe('paused')
  })

  it('checkScaleSessionPause returns the same reference when nothing changes, so a caller can dispatch it every frame cheaply', () => {
    const session = createScaleSession(expected, 'practice', 0)
    expect(checkScaleSessionPause(session, 5)).toBe(session) // hasn't started yet: no-op
    const started = processScaleEvent(session, {
      type: 'onset',
      time: 1.0,
      midi: 60,
      cents: 0,
      confidence: 0.9,
    })
    expect(checkScaleSessionPause(started, 5)).toBe(started) // not 8s yet: no-op
  })
})

describe('describeMistake', () => {
  it('formats a skipped note', () => {
    expect(describeMistake({ index: 0, kind: 'skipped', expectedMidi: 62, heardMidi: 64 })).toBe(
      'Skipped D4.',
    )
  })

  it('formats a wrong-octave mistake', () => {
    expect(
      describeMistake({ index: 0, kind: 'wrongOctave', expectedMidi: 60, heardMidi: 72 }),
    ).toBe('Right note, wrong octave: expected C4, heard C5.')
  })

  it('formats a wrong-note mistake', () => {
    expect(describeMistake({ index: 0, kind: 'wrongNote', expectedMidi: 62, heardMidi: 63 })).toBe(
      'Wrong note: expected D4, heard D♯4.',
    )
  })
})

describe('a full clean attempt through the session wrapper', () => {
  it('finishes with no mistakes when every note is played correctly, in order', () => {
    const expected = [60, 62, 64, 62, 60] // matches a tiny up-and-down shape
    let session = createScaleSession(expected, 'test', 0)
    let time = 1.0
    for (const midi of expected) {
      session = processScaleEvent(session, {
        type: 'onset',
        time,
        midi,
        cents: 0,
        confidence: 0.95,
      })
      time += 0.3
    }
    expect(session.attempt.status).toBe('finished')
    expect(session.attempt.mistakes).toEqual([])
  })
})
