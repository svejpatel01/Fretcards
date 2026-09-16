import { describe, expect, it } from 'vitest'
import { ACOUSTIC_GUITAR } from '../../../src/core/instruments/acousticGuitar'
import { fretWindowPositionSystem } from '../../../src/core/fretboard/positions/fretWindow'
import {
  createScaleDeckReducer,
  initScaleDeckState,
  DEFAULT_SCALE_DECK_OPTIONS,
} from '../../../src/ui/routes/scaleDeckReducer'
import type { NoteEvent } from '../../../src/core/audio/noteTracker'

const reducer = createScaleDeckReducer(ACOUSTIC_GUITAR, fretWindowPositionSystem)

describe('scaleDeckReducer', () => {
  it('initializes with the G major position 2 shape by default', () => {
    const state = initScaleDeckState(
      ACOUSTIC_GUITAR,
      fretWindowPositionSystem,
      DEFAULT_SCALE_DECK_OPTIONS,
    )
    expect(state.expected[0]).toBe(42) // F#2, per the Phase 1 golden test
    expect(state.session.attempt.status).toBe('waitingForStart')
  })

  it('setOptions rebuilds the shape for a new key/position', () => {
    const state = initScaleDeckState(
      ACOUSTIC_GUITAR,
      fretWindowPositionSystem,
      DEFAULT_SCALE_DECK_OPTIONS,
    )
    const next = reducer(state, {
      type: 'setOptions',
      options: { keyPitchClass: 0, position: 2 },
      time: 5,
    })
    // C major, position 2, per the Phase 1 golden test: starts on G2 (midi 43).
    expect(next.expected[0]).toBe(43)
    expect(next.session.cardShownTime).toBe(5)
    expect(next.session.attempt.status).toBe('waitingForStart')
  })

  it('grades onsets via the session wrapper', () => {
    const state = initScaleDeckState(
      ACOUSTIC_GUITAR,
      fretWindowPositionSystem,
      DEFAULT_SCALE_DECK_OPTIONS,
    )
    const onset: NoteEvent = {
      type: 'onset',
      time: 1.0,
      midi: state.expected[0],
      cents: 0,
      confidence: 0.9,
    }
    const next = reducer(state, { type: 'noteEvent', event: onset })
    expect(next.session.attempt.index).toBe(1)
  })

  it('retry resets the session but keeps the same expected sequence', () => {
    let state = initScaleDeckState(
      ACOUSTIC_GUITAR,
      fretWindowPositionSystem,
      DEFAULT_SCALE_DECK_OPTIONS,
    )
    state = reducer(state, {
      type: 'noteEvent',
      event: { type: 'onset', time: 1.0, midi: state.expected[0], cents: 0, confidence: 0.9 },
    })
    const expectedBefore = state.expected
    state = reducer(state, { type: 'retry', time: 10 })
    expect(state.expected).toEqual(expectedBefore)
    expect(state.session.attempt.index).toBe(0)
    expect(state.session.cardShownTime).toBe(10)
  })

  it('next without randomDrill just resets the current shape', () => {
    let state = initScaleDeckState(
      ACOUSTIC_GUITAR,
      fretWindowPositionSystem,
      DEFAULT_SCALE_DECK_OPTIONS,
    )
    const expectedBefore = state.expected
    state = reducer(state, { type: 'next', time: 10 })
    expect(state.expected).toEqual(expectedBefore)
  })

  it('next with randomDrill picks a new key/position using the given random function', () => {
    let state = initScaleDeckState(ACOUSTIC_GUITAR, fretWindowPositionSystem, {
      ...DEFAULT_SCALE_DECK_OPTIONS,
      randomDrill: true,
    })
    // A fixed random function makes the pick deterministic.
    state = reducer(state, { type: 'next', time: 10, random: () => 0 })
    // random()=0 -> keyPitchClass index 0 -> pc 0 (C); position index 0 -> lowest available position.
    expect(state.options.keyPitchClass).toBe(0)
    expect(state.options.position).toBe(fretWindowPositionSystem.positions(ACOUSTIC_GUITAR)[0])
  })

  it('checkPause delegates to the session', () => {
    let state = initScaleDeckState(
      ACOUSTIC_GUITAR,
      fretWindowPositionSystem,
      DEFAULT_SCALE_DECK_OPTIONS,
    )
    state = reducer(state, {
      type: 'noteEvent',
      event: { type: 'onset', time: 1.0, midi: state.expected[0], cents: 0, confidence: 0.9 },
    })
    state = reducer(state, { type: 'checkPause', now: 20 })
    expect(state.session.attempt.status).toBe('paused')
  })
})
