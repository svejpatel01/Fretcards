import type { Instrument } from '../../core/instruments/types'
import type { PositionSystem, PositionOptions } from '../../core/fretboard/positions/types'
import type { FretLocation } from '../../core/fretboard/fretboard'
import type { Midi } from '../../core/theory/pitch'
import type { NoteEvent } from '../../core/audio/noteTracker'
import {
  buildScaleSequence,
  checkScaleSessionPause,
  createScaleSession,
  processScaleEvent,
  type ScaleSession,
} from '../../core/exercises/scaleDeck'

export interface ScaleDeckOptions {
  keyPitchClass: Midi
  position: number
  mode: 'test' | 'practice'
  range: NonNullable<PositionOptions['range']>
  stretch: NonNullable<PositionOptions['stretch']>
  randomDrill: boolean
}

export const DEFAULT_SCALE_DECK_OPTIONS: ScaleDeckOptions = {
  keyPitchClass: 7, // G
  position: 2,
  mode: 'practice',
  range: 'full',
  stretch: 'pinky',
  randomDrill: false,
}

export interface ScaleDeckState {
  options: ScaleDeckOptions
  ascending: FretLocation[]
  expected: Midi[]
  session: ScaleSession
}

function buildShape(
  instrument: Instrument,
  positionSystem: PositionSystem,
  options: ScaleDeckOptions,
) {
  const ascending = positionSystem.majorScaleShape(
    instrument,
    options.keyPitchClass,
    options.position,
    {
      range: options.range,
      stretch: options.stretch,
    },
  )
  const expected = buildScaleSequence(instrument, ascending)
  return { ascending, expected }
}

export function initScaleDeckState(
  instrument: Instrument,
  positionSystem: PositionSystem,
  options: ScaleDeckOptions,
): ScaleDeckState {
  const { ascending, expected } = buildShape(instrument, positionSystem, options)
  return { options, ascending, expected, session: createScaleSession(expected, options.mode, 0) }
}

function randomKeyAndPosition(
  instrument: Instrument,
  positionSystem: PositionSystem,
  random: () => number,
) {
  const keyPitchClass = Math.floor(random() * 12)
  const positions = positionSystem.positions(instrument)
  const position = positions[Math.floor(random() * positions.length)]
  return { keyPitchClass, position }
}

export type ScaleDeckAction =
  | { type: 'setOptions'; options: Partial<ScaleDeckOptions>; time: number }
  | { type: 'noteEvent'; event: NoteEvent }
  | { type: 'checkPause'; now: number }
  | { type: 'retry'; time: number }
  | { type: 'next'; time: number; random?: () => number }

export function createScaleDeckReducer(instrument: Instrument, positionSystem: PositionSystem) {
  return function scaleDeckReducer(state: ScaleDeckState, action: ScaleDeckAction): ScaleDeckState {
    switch (action.type) {
      case 'setOptions': {
        const options = { ...state.options, ...action.options }
        const { ascending, expected } = buildShape(instrument, positionSystem, options)
        return {
          options,
          ascending,
          expected,
          session: createScaleSession(expected, options.mode, action.time),
        }
      }

      case 'noteEvent': {
        const session = processScaleEvent(state.session, action.event)
        return { ...state, session }
      }

      case 'checkPause': {
        const session = checkScaleSessionPause(state.session, action.now)
        return session === state.session ? state : { ...state, session }
      }

      case 'retry':
        return {
          ...state,
          session: createScaleSession(state.expected, state.options.mode, action.time),
        }

      case 'next': {
        if (!state.options.randomDrill) {
          return {
            ...state,
            session: createScaleSession(state.expected, state.options.mode, action.time),
          }
        }
        const random = action.random ?? Math.random
        const { keyPitchClass, position } = randomKeyAndPosition(instrument, positionSystem, random)
        const options = { ...state.options, keyPitchClass, position }
        const { ascending, expected } = buildShape(instrument, positionSystem, options)
        return {
          options,
          ascending,
          expected,
          session: createScaleSession(expected, options.mode, action.time),
        }
      }
    }
  }
}
