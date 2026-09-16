import type { Instrument } from '../instruments/types'
import type { FretRange } from '../fretboard/fretboard'
import { pitchClass, noteName, type Midi } from '../theory/pitch'
import type { NoteEvent } from '../audio/noteTracker'

const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11] // C D E F G A B
const ALL_PITCH_CLASSES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

/** How long after a card appears to ignore onsets (button clicks, previous note ringing out). PLAN.md section 6.4. */
export const NOTE_CARD_GUARD_SECONDS = 0.3

export interface NoteDeckOptions {
  noteSet: 'naturals' | 'all'
  mode: 'anywhere' | 'onString'
  /** Eligible strings for 'onString' mode; ignored in 'anywhere' mode. */
  strings: number[]
  fretRange: FretRange
  autoAdvance: boolean
  autoAdvanceDelayMs: number
}

export const DEFAULT_NOTE_DECK_OPTIONS: NoteDeckOptions = {
  noteSet: 'all',
  mode: 'anywhere',
  strings: [0, 1, 2, 3, 4, 5],
  fretRange: { min: 0, max: 12 },
  autoAdvance: false,
  autoAdvanceDelayMs: 800,
}

export interface NoteCard {
  target: Midi // pitch class 0-11
  mode: 'anywhere' | 'onString'
  string?: number // present when mode === 'onString'
  fretRange: FretRange
}

export function cardKey(card: NoteCard): string {
  return card.mode === 'anywhere' ? `${card.target}` : `${card.target}:${card.string}`
}

export function generateCardPool(options: NoteDeckOptions): NoteCard[] {
  const pitchClasses = options.noteSet === 'naturals' ? NATURAL_PITCH_CLASSES : ALL_PITCH_CLASSES

  if (options.mode === 'anywhere') {
    return pitchClasses.map((target) => ({
      target,
      mode: 'anywhere' as const,
      fretRange: options.fretRange,
    }))
  }

  const cards: NoteCard[] = []
  for (const string of options.strings) {
    for (const target of pitchClasses) {
      cards.push({ target, mode: 'onString' as const, string, fretRange: options.fretRange })
    }
  }
  return cards
}

/** Every MIDI note that satisfies an 'onString' card: open + f for each fret in range with the target pitch class. */
export function acceptedMidisForString(
  instrument: Instrument,
  string: number,
  target: Midi,
  fretRange: FretRange,
): Midi[] {
  const openMidi = instrument.strings[string]
  const accepted: Midi[] = []
  for (let fret = fretRange.min; fret <= fretRange.max; fret++) {
    if (pitchClass(openMidi + fret) === target) accepted.push(openMidi + fret)
  }
  return accepted
}

export type NoteGrade =
  | { correct: true; heard: Midi; cents: number }
  | { correct: false; kind: 'wrongOctave'; heard: Midi }
  | { correct: false; kind: 'wrongNote'; heard: Midi }

export function gradeNoteOnset(
  instrument: Instrument,
  card: NoteCard,
  heardMidi: Midi,
  cents: number,
): NoteGrade {
  const heardPc = pitchClass(heardMidi)

  if (card.mode === 'anywhere') {
    return heardPc === card.target
      ? { correct: true, heard: heardMidi, cents }
      : { correct: false, kind: 'wrongNote', heard: heardMidi }
  }

  const accepted = acceptedMidisForString(instrument, card.string!, card.target, card.fretRange)
  if (accepted.includes(heardMidi)) return { correct: true, heard: heardMidi, cents }
  if (heardPc === card.target) return { correct: false, kind: 'wrongOctave', heard: heardMidi }
  return { correct: false, kind: 'wrongNote', heard: heardMidi }
}

export function describeNoteGrade(
  grade: NoteGrade,
  target: Midi,
  opts: { preferFlats?: boolean } = {},
): string {
  const targetName = noteName(target, { includeOctave: false, preferFlats: opts.preferFlats })
  if (grade.correct) {
    const sign = grade.cents >= 0 ? '+' : ''
    return `${noteName(grade.heard, opts)}, correct (${sign}${Math.round(grade.cents)}¢)`
  }
  if (grade.kind === 'wrongOctave') {
    return 'Right note, wrong octave for that string.'
  }
  return `Heard ${noteName(grade.heard, opts)}. Target was ${targetName}.`
}

// --- Card session: applies the guard window and grades the first onset after it ---

export interface NoteCardSession {
  card: NoteCard
  cardShownTime: number
  result: NoteGrade | null
  resultTime: number | null
}

export function createNoteCardSession(card: NoteCard, cardShownTime: number): NoteCardSession {
  return { card, cardShownTime, result: null, resultTime: null }
}

export function processNoteEventForCard(
  instrument: Instrument,
  session: NoteCardSession,
  event: NoteEvent,
): NoteCardSession {
  if (session.result !== null) return session
  if (event.type !== 'onset') return session
  if (event.time - session.cardShownTime < NOTE_CARD_GUARD_SECONDS) return session

  const grade = gradeNoteOnset(instrument, session.card, event.midi, event.cents)
  return { ...session, result: grade, resultTime: event.time }
}

// --- Progress-weighted card selection ---

export interface NoteProgress {
  attempts: number
  correct: number
  responseTimesMs: number[]
}

export type NoteDeckProgress = Record<string, NoteProgress>

const MAX_RESPONSE_HISTORY = 20
const UNSEEN_WEIGHT = 2
const SLOW_RESPONSE_MS = 3000

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function cardWeight(progress: NoteProgress | undefined): number {
  if (!progress || progress.attempts === 0) return UNSEEN_WEIGHT
  const accuracy = progress.correct / progress.attempts
  const medianTimeMs = median(progress.responseTimesMs)
  const timeFactor = Math.min(1, medianTimeMs / SLOW_RESPONSE_MS)
  return (1 - accuracy) * 1.5 + timeFactor * 0.5 + 0.1 // small floor: even a perfect, fast card can still come up
}

export function recordAttempt(
  progress: NoteDeckProgress,
  card: NoteCard,
  correct: boolean,
  responseTimeMs: number,
): NoteDeckProgress {
  const key = cardKey(card)
  const existing = progress[key] ?? { attempts: 0, correct: 0, responseTimesMs: [] }
  const updated: NoteProgress = {
    attempts: existing.attempts + 1,
    correct: existing.correct + (correct ? 1 : 0),
    responseTimesMs: [...existing.responseTimesMs, responseTimeMs].slice(-MAX_RESPONSE_HISTORY),
  }
  return { ...progress, [key]: updated }
}

/** Weighted-random next card, favoring low accuracy and slow responses; never repeats the previous card. */
export function pickNextCard(
  pool: NoteCard[],
  progress: NoteDeckProgress,
  previousCard: NoteCard | null,
  random: () => number = Math.random,
): NoteCard {
  const candidates = previousCard ? pool.filter((c) => cardKey(c) !== cardKey(previousCard)) : pool
  if (candidates.length === 0) return pool[0]

  const weights = candidates.map((c) => cardWeight(progress[cardKey(c)]))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let r = random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}
