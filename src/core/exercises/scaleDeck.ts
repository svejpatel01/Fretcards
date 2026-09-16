import type { Instrument } from '../instruments/types'
import { midiAt, type FretLocation } from '../fretboard/fretboard'
import { noteName, pitchClass, type Midi } from '../theory/pitch'
import type { NoteEvent } from '../audio/noteTracker'

export const SCALE_CARD_GUARD_SECONDS = 0.3
export const SCALE_PAUSE_TIMEOUT_SECONDS = 8

/** Ascending shape -> full up-and-down sequence, without repeating the top note (PLAN.md section 6.2). */
export function buildScaleSequence(instrument: Instrument, ascending: FretLocation[]): Midi[] {
  const ascendingMidi = ascending.map((loc) => midiAt(instrument, loc))
  const descending = [...ascendingMidi].slice(0, -1).reverse()
  return [...ascendingMidi, ...descending]
}

export type MistakeKind = 'wrongNote' | 'wrongOctave' | 'skipped'

export interface ScaleMistake {
  index: number // position in `expected` this mistake is attributed to
  kind: MistakeKind
  expectedMidi: Midi
  heardMidi: Midi
}

export function describeMistake(
  mistake: ScaleMistake,
  opts: { preferFlats?: boolean } = {},
): string {
  const expectedName = noteName(mistake.expectedMidi, opts)
  const heardName = noteName(mistake.heardMidi, opts)
  switch (mistake.kind) {
    case 'skipped':
      return `Skipped ${expectedName}.`
    case 'wrongOctave':
      return `Right note, wrong octave: expected ${expectedName}, heard ${heardName}.`
    case 'wrongNote':
      return `Wrong note: expected ${expectedName}, heard ${heardName}.`
  }
}

type OnsetOutcome =
  | { kind: 'correct' }
  | { kind: 'repick' }
  | { kind: 'skipped'; matchedIndex: number }
  | { kind: 'wrongOctave' }
  | { kind: 'wrongNote' }

function classifyOnset(expected: Midi[], index: number, heardMidi: Midi): OnsetOutcome {
  if (heardMidi === expected[index]) return { kind: 'correct' }
  if (index > 0 && heardMidi === expected[index - 1]) return { kind: 'repick' }
  if (index + 1 < expected.length && heardMidi === expected[index + 1]) {
    return { kind: 'skipped', matchedIndex: index + 1 }
  }
  if (pitchClass(heardMidi) === pitchClass(expected[index])) return { kind: 'wrongOctave' }
  return { kind: 'wrongNote' }
}

export type ScaleAttemptStatus = 'waitingForStart' | 'inProgress' | 'paused' | 'finished' | 'failed'

export interface ScaleAttemptState {
  expected: Midi[]
  mode: 'test' | 'practice'
  index: number
  mistakes: ScaleMistake[]
  status: ScaleAttemptStatus
  startTime: number | null // set on the first accepted onset, not when the card appears
  lastEventTime: number | null
}

export function createScaleAttempt(expected: Midi[], mode: 'test' | 'practice'): ScaleAttemptState {
  return {
    expected,
    mode,
    index: 0,
    mistakes: [],
    status: 'waitingForStart',
    startTime: null,
    lastEventTime: null,
  }
}

/** Advances an in-progress or not-yet-started attempt by one onset. No-op once finished/failed. */
export function processScaleOnset(
  state: ScaleAttemptState,
  time: number,
  heardMidi: Midi,
): ScaleAttemptState {
  if (state.status === 'finished' || state.status === 'failed') return state

  const startTime = state.startTime ?? time
  // Any accepted onset resumes progress, whether we were waiting to start or paused mid-attempt.
  const resumedStatus: ScaleAttemptStatus = 'inProgress'
  const outcome = classifyOnset(state.expected, state.index, heardMidi)

  if (outcome.kind === 'repick') {
    return { ...state, status: resumedStatus, startTime, lastEventTime: time }
  }

  if (outcome.kind === 'correct') {
    const index = state.index + 1
    const status: ScaleAttemptStatus = index === state.expected.length ? 'finished' : resumedStatus
    return { ...state, index, status, startTime, lastEventTime: time }
  }

  if (outcome.kind === 'skipped') {
    const mistake: ScaleMistake = {
      index: state.index,
      kind: 'skipped',
      expectedMidi: state.expected[state.index],
      heardMidi,
    }
    const mistakes = [...state.mistakes, mistake]
    if (state.mode === 'test') {
      return { ...state, mistakes, status: 'failed', startTime, lastEventTime: time }
    }
    const index = outcome.matchedIndex + 1
    const status: ScaleAttemptStatus = index === state.expected.length ? 'finished' : resumedStatus
    return { ...state, index, mistakes, status, startTime, lastEventTime: time }
  }

  // wrongNote or wrongOctave
  const mistake: ScaleMistake = {
    index: state.index,
    kind: outcome.kind,
    expectedMidi: state.expected[state.index],
    heardMidi,
  }
  const mistakes = [...state.mistakes, mistake]
  const status: ScaleAttemptStatus = state.mode === 'test' ? 'failed' : resumedStatus
  return { ...state, mistakes, status, startTime, lastEventTime: time }
}

/** Call periodically (e.g. on every pitch reading) to detect an 8s silence mid-attempt. */
export function checkScalePause(state: ScaleAttemptState, now: number): ScaleAttemptState {
  if (state.status !== 'inProgress') return state
  const lastTime = state.lastEventTime ?? state.startTime
  if (lastTime === null) return state
  if (now - lastTime >= SCALE_PAUSE_TIMEOUT_SECONDS) {
    return { ...state, status: 'paused' }
  }
  return state
}

// --- Session wrapper: applies the card-shown guard, then delegates to the attempt state machine ---

export interface ScaleSession {
  attempt: ScaleAttemptState
  cardShownTime: number
}

export function createScaleSession(
  expected: Midi[],
  mode: 'test' | 'practice',
  cardShownTime: number,
): ScaleSession {
  return { attempt: createScaleAttempt(expected, mode), cardShownTime }
}

export function processScaleEvent(session: ScaleSession, event: NoteEvent): ScaleSession {
  if (event.type !== 'onset') return session
  if (event.time - session.cardShownTime < SCALE_CARD_GUARD_SECONDS) return session
  return { ...session, attempt: processScaleOnset(session.attempt, event.time, event.midi) }
}

/** Returns `session` unchanged (same reference) if nothing changed, so callers can dispatch this every frame cheaply. */
export function checkScaleSessionPause(session: ScaleSession, now: number): ScaleSession {
  const attempt = checkScalePause(session.attempt, now)
  return attempt === session.attempt ? session : { ...session, attempt }
}
