import type { Instrument } from '../../core/instruments/types'
import type { NoteEvent } from '../../core/audio/noteTracker'
import {
  createNoteCardSession,
  generateCardPool,
  pickNextCard,
  processNoteEventForCard,
  recordAttempt,
  type NoteCard,
  type NoteCardSession,
  type NoteDeckOptions,
  type NoteDeckProgress,
} from '../../core/exercises/noteDeck'

export interface NoteDeckState {
  options: NoteDeckOptions
  pool: NoteCard[]
  progress: NoteDeckProgress
  currentCard: NoteCard
  session: NoteCardSession
  showReveal: boolean
}

export type NoteDeckAction =
  | { type: 'setOptions'; options: Partial<NoteDeckOptions>; time: number }
  | { type: 'noteEvent'; event: NoteEvent }
  | { type: 'next'; time: number }
  | { type: 'tryAgain'; time: number }
  | { type: 'toggleReveal' }

export function initNoteDeckState(options: NoteDeckOptions): NoteDeckState {
  const pool = generateCardPool(options)
  const currentCard = pickNextCard(pool, {}, null)
  return {
    options,
    pool,
    progress: {},
    currentCard,
    session: createNoteCardSession(currentCard, 0),
    showReveal: false,
  }
}

export function createNoteDeckReducer(instrument: Instrument) {
  return function noteDeckReducer(state: NoteDeckState, action: NoteDeckAction): NoteDeckState {
    switch (action.type) {
      case 'setOptions': {
        const options = { ...state.options, ...action.options }
        const pool = generateCardPool(options)
        const currentCard = pickNextCard(pool, state.progress, null)
        return {
          ...state,
          options,
          pool,
          currentCard,
          session: createNoteCardSession(currentCard, action.time),
          showReveal: false,
        }
      }

      case 'noteEvent': {
        const session = processNoteEventForCard(instrument, state.session, action.event)
        if (session.result && !state.session.result) {
          const responseTimeMs = (session.resultTime! - session.cardShownTime) * 1000
          const progress = recordAttempt(
            state.progress,
            state.currentCard,
            session.result.correct,
            responseTimeMs,
          )
          return { ...state, session, progress }
        }
        return { ...state, session }
      }

      case 'next': {
        const currentCard = pickNextCard(state.pool, state.progress, state.currentCard)
        return {
          ...state,
          currentCard,
          session: createNoteCardSession(currentCard, action.time),
          showReveal: false,
        }
      }

      case 'tryAgain':
        return {
          ...state,
          session: createNoteCardSession(state.currentCard, action.time),
          showReveal: false,
        }

      case 'toggleReveal':
        return { ...state, showReveal: !state.showReveal }
    }
  }
}
