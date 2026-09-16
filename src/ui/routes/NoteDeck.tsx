import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACOUSTIC_GUITAR } from '../../core/instruments/acousticGuitar'
import { hzToMidi, noteName, pitchClassName } from '../../core/theory/pitch'
import { locationsForPitchClass } from '../../core/fretboard/fretboard'
import { computeGateDb } from '../../core/audio/noteTracker'
import {
  describeNoteGrade,
  DEFAULT_NOTE_DECK_OPTIONS,
  type NoteCard,
} from '../../core/exercises/noteDeck'
import { useAudioEngine } from '../hooks/useAudioEngine'
import { MicPermissionGate } from '../components/MicPermissionGate'
import { LevelMeter } from '../components/LevelMeter'
import { Flashcard } from '../components/Flashcard'
import { ResultBanner } from '../components/ResultBanner'
import { createNoteDeckReducer, initNoteDeckState } from './noteDeckReducer'
import styles from './NoteDeck.module.css'

const STRING_NAMES = ['low E', 'A', 'D', 'G', 'B', 'high E']
const reducer = createNoteDeckReducer(ACOUSTIC_GUITAR)

function cardLabel(card: NoteCard, preferFlats: boolean): string {
  const pcName = pitchClassName(card.target, { preferFlats })
  return card.mode === 'onString' ? `${pcName} on the ${STRING_NAMES[card.string!]} string` : pcName
}

function revealText(card: NoteCard): string {
  const locations = locationsForPitchClass(ACOUSTIC_GUITAR, card.target, card.fretRange)
  if (locations.length === 0) return 'No locations in the current fret range.'
  return locations.map((loc) => `${STRING_NAMES[loc.string]} string, fret ${loc.fret}`).join(' · ')
}

export function NoteDeck() {
  const navigate = useNavigate()
  const engine = useAudioEngine()
  const [preferFlats, setPreferFlats] = useState(false)
  const [hideReadout, setHideReadout] = useState(false)
  const [state, dispatch] = useReducer(reducer, DEFAULT_NOTE_DECK_OPTIONS, initNoteDeckState)

  const readingTimeRef = useRef(0)
  const { reading } = engine
  useEffect(() => {
    if (reading) readingTimeRef.current = reading.time
  }, [reading])

  const { onNoteEvent } = engine
  useEffect(() => onNoteEvent((event) => dispatch({ type: 'noteEvent', event })), [onNoteEvent])

  const result = state.session.result

  // Auto-advance after a correct answer.
  useEffect(() => {
    if (!result?.correct || !state.options.autoAdvance) return
    const id = setTimeout(() => {
      dispatch({ type: 'next', time: readingTimeRef.current })
    }, state.options.autoAdvanceDelayMs)
    return () => clearTimeout(id)
  }, [result, state.options.autoAdvance, state.options.autoAdvanceDelayMs])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === ' ') {
        e.preventDefault()
        if (!result) return
        dispatch(
          result.correct
            ? { type: 'next', time: readingTimeRef.current }
            : { type: 'tryAgain', time: readingTimeRef.current },
        )
      } else if (e.key.toLowerCase() === 'r') {
        dispatch({ type: 'toggleReveal' })
      } else if (e.key === 'Escape') {
        navigate('/decks')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [result, navigate])

  const midiFloat = engine.reading?.hz != null ? hzToMidi(engine.reading.hz) : null
  const heardMidi = midiFloat !== null ? Math.round(midiFloat) : null
  const hearing = heardMidi !== null ? noteName(heardMidi, { preferFlats }) : null
  const gateDb = engine.noiseFloorDb !== null ? computeGateDb(engine.noiseFloorDb) : undefined

  return (
    <section>
      <h1>Note finder</h1>
      <p>Play the note shown on the card. Space = next/retry, R = reveal, Esc = back.</p>

      <fieldset className={styles.options}>
        <legend>Deck options</legend>
        <label>
          <input
            type="radio"
            checked={state.options.noteSet === 'all'}
            onChange={() =>
              dispatch({
                type: 'setOptions',
                options: { noteSet: 'all' },
                time: readingTimeRef.current,
              })
            }
          />
          All 12 notes
        </label>
        <label>
          <input
            type="radio"
            checked={state.options.noteSet === 'naturals'}
            onChange={() =>
              dispatch({
                type: 'setOptions',
                options: { noteSet: 'naturals' },
                time: readingTimeRef.current,
              })
            }
          />
          Naturals only
        </label>

        <label>
          <input
            type="radio"
            checked={state.options.mode === 'anywhere'}
            onChange={() =>
              dispatch({
                type: 'setOptions',
                options: { mode: 'anywhere' },
                time: readingTimeRef.current,
              })
            }
          />
          Anywhere
        </label>
        <label>
          <input
            type="radio"
            checked={state.options.mode === 'onString'}
            onChange={() =>
              dispatch({
                type: 'setOptions',
                options: { mode: 'onString' },
                time: readingTimeRef.current,
              })
            }
          />
          On a string
        </label>

        {state.options.mode === 'onString' && (
          <span className={styles.strings}>
            {STRING_NAMES.map((name, i) => (
              <label key={name}>
                <input
                  type="checkbox"
                  checked={state.options.strings.includes(i)}
                  onChange={(e) => {
                    const strings = e.target.checked
                      ? [...state.options.strings, i]
                      : state.options.strings.filter((s) => s !== i)
                    dispatch({
                      type: 'setOptions',
                      options: { strings },
                      time: readingTimeRef.current,
                    })
                  }}
                />
                {name}
              </label>
            ))}
          </span>
        )}

        <label>
          Fret range:{' '}
          <select
            value={state.options.fretRange.max}
            onChange={(e) =>
              dispatch({
                type: 'setOptions',
                options: { fretRange: { min: 0, max: Number(e.target.value) } },
                time: readingTimeRef.current,
              })
            }
          >
            <option value={5}>0-5</option>
            <option value={12}>0-12</option>
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            checked={state.options.autoAdvance}
            onChange={(e) =>
              dispatch({
                type: 'setOptions',
                options: { autoAdvance: e.target.checked },
                time: readingTimeRef.current,
              })
            }
          />
          Auto-advance after correct
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferFlats}
            onChange={(e) => setPreferFlats(e.target.checked)}
          />
          Show flats
        </label>
        <label>
          <input
            type="checkbox"
            checked={hideReadout}
            onChange={(e) => setHideReadout(e.target.checked)}
          />
          Hide live readout (harder)
        </label>
      </fieldset>

      <MicPermissionGate
        status={engine.status}
        error={engine.error}
        calibrationProgress={engine.calibrationProgress}
        onStart={() => void engine.start()}
        onSkipCalibration={engine.skipCalibration}
      >
        <div className={styles.deck}>
          <Flashcard label={cardLabel(state.currentCard, preferFlats)} />

          {!hideReadout && <p className={styles.hearing}>Hearing: {hearing ?? '—'}</p>}
          <LevelMeter rms={engine.reading?.rms ?? 0} gateDb={gateDb} />

          {result && (
            <ResultBanner
              correct={result.correct}
              message={describeNoteGrade(result, state.currentCard.target, { preferFlats })}
            />
          )}

          {state.showReveal && <p className={styles.reveal}>{revealText(state.currentCard)}</p>}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => dispatch({ type: 'tryAgain', time: readingTimeRef.current })}
            >
              Try again
            </button>
            <button type="button" onClick={() => dispatch({ type: 'toggleReveal' })}>
              Reveal
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'next', time: readingTimeRef.current })}
            >
              Next
            </button>
          </div>
        </div>
      </MicPermissionGate>
    </section>
  )
}
