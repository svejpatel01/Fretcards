import { describe, expect, it } from 'vitest'
import { ACOUSTIC_GUITAR } from '../../../src/core/instruments/acousticGuitar'
import {
  acceptedMidisForString,
  cardKey,
  createNoteCardSession,
  describeNoteGrade,
  gradeNoteOnset,
  generateCardPool,
  pickNextCard,
  processNoteEventForCard,
  recordAttempt,
  type NoteCard,
  type NoteDeckProgress,
} from '../../../src/core/exercises/noteDeck'
import type { NoteEvent } from '../../../src/core/audio/noteTracker'

describe('generateCardPool', () => {
  it('anywhere + naturals: one card per natural pitch class', () => {
    const pool = generateCardPool({
      noteSet: 'naturals',
      mode: 'anywhere',
      strings: [0, 1, 2, 3, 4, 5],
      fretRange: { min: 0, max: 12 },
      autoAdvance: false,
      autoAdvanceDelayMs: 800,
    })
    expect(pool).toHaveLength(7)
    expect(pool.map((c) => c.target).sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11])
  })

  it('anywhere + all: one card per pitch class', () => {
    const pool = generateCardPool({
      noteSet: 'all',
      mode: 'anywhere',
      strings: [0, 1, 2, 3, 4, 5],
      fretRange: { min: 0, max: 12 },
      autoAdvance: false,
      autoAdvanceDelayMs: 800,
    })
    expect(pool).toHaveLength(12)
  })

  it('onString: one card per (string, pitch class) pair for the selected strings', () => {
    const pool = generateCardPool({
      noteSet: 'naturals',
      mode: 'onString',
      strings: [0, 1],
      fretRange: { min: 0, max: 12 },
      autoAdvance: false,
      autoAdvanceDelayMs: 800,
    })
    expect(pool).toHaveLength(14) // 2 strings x 7 naturals
    expect(pool.every((c) => c.mode === 'onString' && [0, 1].includes(c.string!))).toBe(true)
  })
})

describe('acceptedMidisForString', () => {
  it('finds a single fret when the range does not reach past fret 12', () => {
    // A string (open = midi 45, A2), target pitch class A (9): only open (fret 0) in 0-11.
    expect(acceptedMidisForString(ACOUSTIC_GUITAR, 1, 9, { min: 0, max: 11 })).toEqual([45])
  })

  it('finds two frets when the range reaches past fret 12', () => {
    // A string, target A: open (fret 0) and fret 12 (octave up), within 0-12.
    expect(acceptedMidisForString(ACOUSTIC_GUITAR, 1, 9, { min: 0, max: 12 })).toEqual([45, 57])
  })

  it('finds nothing when no fret in range matches', () => {
    expect(acceptedMidisForString(ACOUSTIC_GUITAR, 1, 9, { min: 1, max: 11 })).toEqual([])
  })
})

describe('gradeNoteOnset', () => {
  it('anywhere mode: correct regardless of octave', () => {
    const card: NoteCard = { target: 6, mode: 'anywhere', fretRange: { min: 0, max: 12 } } // F#
    expect(gradeNoteOnset(ACOUSTIC_GUITAR, card, 66, 2)).toEqual({
      correct: true,
      heard: 66,
      cents: 2,
    }) // F#4
    expect(gradeNoteOnset(ACOUSTIC_GUITAR, card, 54, -3)).toEqual({
      correct: true,
      heard: 54,
      cents: -3,
    }) // F#3
  })

  it('anywhere mode: wrong note', () => {
    const card: NoteCard = { target: 6, mode: 'anywhere', fretRange: { min: 0, max: 12 } } // F#
    expect(gradeNoteOnset(ACOUSTIC_GUITAR, card, 67, 0)).toEqual({
      correct: false,
      kind: 'wrongNote',
      heard: 67,
    }) // G4
  })

  it('onString mode: correct on the named string', () => {
    // A string (index 1), target A (pc 9): fret 0 (midi 45) is correct.
    const card: NoteCard = {
      target: 9,
      mode: 'onString',
      string: 1,
      fretRange: { min: 0, max: 12 },
    }
    expect(gradeNoteOnset(ACOUSTIC_GUITAR, card, 45, 0)).toEqual({
      correct: true,
      heard: 45,
      cents: 0,
    })
  })

  it('onString mode: right pitch class, wrong string -> wrong octave', () => {
    // Same A pitch class, but played on the low E string at fret 5 (midi 45) IS actually midi 45 too...
    // use a pitch class present on the D string but not reachable on the A string in range, to force "another octave".
    // D string (index 2, open midi 50), target D (pc 2): fret 0 is correct there.
    // On the A string (index 1), the D pitch class appears at fret 5 (midi 50) -- different note than card's string.
    const card: NoteCard = { target: 2, mode: 'onString', string: 2, fretRange: { min: 0, max: 3 } } // D string, low frets only
    // Play the D an octave up (midi 62, D4) which is out of the card's fret range on the D string.
    expect(gradeNoteOnset(ACOUSTIC_GUITAR, card, 62, 0)).toEqual({
      correct: false,
      kind: 'wrongOctave',
      heard: 62,
    })
  })

  it('onString mode: wrong note entirely', () => {
    const card: NoteCard = {
      target: 9,
      mode: 'onString',
      string: 1,
      fretRange: { min: 0, max: 12 },
    } // A string, target A
    expect(gradeNoteOnset(ACOUSTIC_GUITAR, card, 46, 0)).toEqual({
      correct: false,
      kind: 'wrongNote',
      heard: 46,
    }) // A#
  })
})

describe('describeNoteGrade', () => {
  it('formats a correct result with signed cents', () => {
    expect(describeNoteGrade({ correct: true, heard: 66, cents: 12 }, 6)).toBe(
      'F♯4, correct (+12¢)',
    )
    expect(describeNoteGrade({ correct: true, heard: 66, cents: -5 }, 6)).toBe('F♯4, correct (-5¢)')
  })

  it('formats a wrong-note result with the target pitch class only (no octave)', () => {
    expect(describeNoteGrade({ correct: false, kind: 'wrongNote', heard: 67 }, 6)).toBe(
      'Heard G4. Target was F♯.',
    )
  })

  it('formats a wrong-octave result', () => {
    expect(describeNoteGrade({ correct: false, kind: 'wrongOctave', heard: 62 }, 2)).toBe(
      'Right note, wrong octave for that string.',
    )
  })
})

describe('note card session (guard + first-onset grading)', () => {
  const card: NoteCard = { target: 6, mode: 'anywhere', fretRange: { min: 0, max: 12 } } // F#

  it('ignores onsets within the 300ms guard', () => {
    let session = createNoteCardSession(card, 10.0)
    const earlyOnset: NoteEvent = {
      type: 'onset',
      time: 10.2,
      midi: 66,
      cents: 0,
      confidence: 0.99,
    }
    session = processNoteEventForCard(ACOUSTIC_GUITAR, session, earlyOnset)
    expect(session.result).toBeNull()
  })

  it('grades the first onset after the guard', () => {
    let session = createNoteCardSession(card, 10.0)
    const onset: NoteEvent = { type: 'onset', time: 10.35, midi: 66, cents: 4, confidence: 0.99 }
    session = processNoteEventForCard(ACOUSTIC_GUITAR, session, onset)
    expect(session.result).toEqual({ correct: true, heard: 66, cents: 4 })
    expect(session.resultTime).toBe(10.35)
  })

  it('ignores further events once a result is set', () => {
    let session = createNoteCardSession(card, 10.0)
    session = processNoteEventForCard(ACOUSTIC_GUITAR, session, {
      type: 'onset',
      time: 10.35,
      midi: 66,
      cents: 0,
      confidence: 0.99,
    })
    const secondOnset: NoteEvent = {
      type: 'onset',
      time: 10.5,
      midi: 60,
      cents: 0,
      confidence: 0.99,
    }
    session = processNoteEventForCard(ACOUSTIC_GUITAR, session, secondOnset)
    expect(session.result).toEqual({ correct: true, heard: 66, cents: 0 }) // unchanged
  })

  it('ignores offset events', () => {
    let session = createNoteCardSession(card, 10.0)
    session = processNoteEventForCard(ACOUSTIC_GUITAR, session, { type: 'offset', time: 10.35 })
    expect(session.result).toBeNull()
  })
})

describe('recordAttempt + pickNextCard progress weighting', () => {
  const pool: NoteCard[] = [0, 2, 4].map((target) => ({
    target,
    mode: 'anywhere',
    fretRange: { min: 0, max: 12 },
  }))

  it('never repeats the previous card', () => {
    const progress: NoteDeckProgress = {}
    const previous = pool[0]
    // Run many trials; the previous card must never be chosen.
    for (let i = 0; i < 200; i++) {
      const next = pickNextCard(pool, progress, previous, Math.random)
      expect(cardKey(next)).not.toBe(cardKey(previous))
    }
  })

  it('favors a card with low accuracy over one with high accuracy', () => {
    let progress: NoteDeckProgress = {}
    // Card 0 (pitch class 0): mostly wrong. Cards 1 and 2 (pitch classes 2, 4): mostly right.
    for (let i = 0; i < 10; i++) progress = recordAttempt(progress, pool[0], false, 1000)
    for (let i = 0; i < 10; i++) progress = recordAttempt(progress, pool[1], true, 500)
    for (let i = 0; i < 10; i++) progress = recordAttempt(progress, pool[2], true, 500)

    const byTarget = { 0: 0, 2: 0, 4: 0 }
    const trials = 2000
    for (let i = 0; i < trials; i++) {
      // previousCard is null so all 3 remain candidates on every trial.
      const next = pickNextCard(pool, progress, null, Math.random)
      byTarget[next.target as 0 | 2 | 4]++
    }
    expect(byTarget[0]).toBeGreaterThan(byTarget[2])
  })

  it('gives an unseen card at least as much weight as a low-accuracy card', () => {
    let progress: NoteDeckProgress = {}
    for (let i = 0; i < 10; i++) progress = recordAttempt(progress, pool[0], false, 1000)
    // pool[1] and pool[2] are unseen.

    const byTarget = { 0: 0, 2: 0, 4: 0 }
    const trials = 2000
    for (let i = 0; i < trials; i++) {
      const next = pickNextCard(pool, progress, null, Math.random)
      byTarget[next.target as 0 | 2 | 4]++
    }
    // Unseen cards (2, 4) should each appear roughly as often as the low-accuracy card (0), not far less.
    expect(byTarget[2]).toBeGreaterThan(trials * 0.15)
    expect(byTarget[4]).toBeGreaterThan(trials * 0.15)
  })
})

describe('recordAttempt', () => {
  it('accumulates attempts, correct count, and a capped response-time history', () => {
    const card: NoteCard = { target: 0, mode: 'anywhere', fretRange: { min: 0, max: 12 } }
    let progress: NoteDeckProgress = {}
    progress = recordAttempt(progress, card, true, 400)
    progress = recordAttempt(progress, card, false, 900)
    const entry = progress[cardKey(card)]
    expect(entry.attempts).toBe(2)
    expect(entry.correct).toBe(1)
    expect(entry.responseTimesMs).toEqual([400, 900])
  })
})
