import { describe, expect, it } from 'vitest'
import { ACOUSTIC_GUITAR } from '../../../src/core/instruments/acousticGuitar'
import { DEFAULT_NOTE_DECK_OPTIONS } from '../../../src/core/exercises/noteDeck'
import { createNoteDeckReducer, initNoteDeckState } from '../../../src/ui/routes/noteDeckReducer'
import type { NoteEvent } from '../../../src/core/audio/noteTracker'

const reducer = createNoteDeckReducer(ACOUSTIC_GUITAR)

describe('noteDeckReducer', () => {
  it('setOptions regenerates the pool and picks a fresh, un-resolved card', () => {
    const state = initNoteDeckState(DEFAULT_NOTE_DECK_OPTIONS)
    const next = reducer(state, {
      type: 'setOptions',
      options: { noteSet: 'naturals' },
      time: 5,
    })
    expect(next.options.noteSet).toBe('naturals')
    expect(next.pool).toHaveLength(7)
    expect(next.session.result).toBeNull()
    expect(next.session.cardShownTime).toBe(5)
    expect(next.showReveal).toBe(false)
  })

  it('grades a correct onset and records progress', () => {
    const state = initNoteDeckState({
      ...DEFAULT_NOTE_DECK_OPTIONS,
      mode: 'anywhere',
      noteSet: 'all',
    })
    const target = state.currentCard.target
    const onset: NoteEvent = {
      type: 'onset',
      time: state.session.cardShownTime + 0.5,
      midi: 60 + target, // some octave with the right pitch class
      cents: 3,
      confidence: 0.98,
    }
    const next = reducer(state, { type: 'noteEvent', event: onset })
    expect(next.session.result).toEqual({ correct: true, heard: 60 + target, cents: 3 })
    const key =
      next.session.card.mode === 'anywhere' ? `${target}` : `${target}:${next.session.card.string}`
    expect(next.progress[key]).toEqual({ attempts: 1, correct: 1, responseTimesMs: [500] })
  })

  it('ignores onsets inside the 300ms guard', () => {
    const state = initNoteDeckState(DEFAULT_NOTE_DECK_OPTIONS)
    const onset: NoteEvent = {
      type: 'onset',
      time: state.session.cardShownTime + 0.1,
      midi: 60,
      cents: 0,
      confidence: 0.98,
    }
    const next = reducer(state, { type: 'noteEvent', event: onset })
    expect(next.session.result).toBeNull()
  })

  it('does not double-record progress for events after a result is already set', () => {
    let state = initNoteDeckState(DEFAULT_NOTE_DECK_OPTIONS)
    const target = state.currentCard.target
    state = reducer(state, {
      type: 'noteEvent',
      event: {
        type: 'onset',
        time: state.session.cardShownTime + 0.5,
        midi: 60 + target,
        cents: 0,
        confidence: 0.9,
      },
    })
    const afterFirst = state.progress
    state = reducer(state, {
      type: 'noteEvent',
      event: {
        type: 'onset',
        time: state.session.cardShownTime + 0.8,
        midi: 61 + target,
        cents: 0,
        confidence: 0.9,
      },
    })
    expect(state.progress).toEqual(afterFirst)
  })

  it('tryAgain resets the session for the same card', () => {
    let state = initNoteDeckState(DEFAULT_NOTE_DECK_OPTIONS)
    const card = state.currentCard
    state = reducer(state, {
      type: 'noteEvent',
      event: {
        type: 'onset',
        time: state.session.cardShownTime + 0.5,
        midi: 71,
        cents: 0,
        confidence: 0.9,
      },
    })
    state = reducer(state, { type: 'tryAgain', time: 20 })
    expect(state.currentCard).toEqual(card)
    expect(state.session.result).toBeNull()
    expect(state.session.cardShownTime).toBe(20)
  })

  it('next picks a different card and resets the session', () => {
    let state = initNoteDeckState(DEFAULT_NOTE_DECK_OPTIONS)
    const previousCard = state.currentCard
    state = reducer(state, { type: 'next', time: 30 })
    expect(state.currentCard).not.toEqual(previousCard)
    expect(state.session.result).toBeNull()
    expect(state.session.cardShownTime).toBe(30)
  })

  it('toggleReveal flips showReveal and next/tryAgain reset it', () => {
    let state = initNoteDeckState(DEFAULT_NOTE_DECK_OPTIONS)
    state = reducer(state, { type: 'toggleReveal' })
    expect(state.showReveal).toBe(true)
    state = reducer(state, { type: 'tryAgain', time: 1 })
    expect(state.showReveal).toBe(false)
  })
})
