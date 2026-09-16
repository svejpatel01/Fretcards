import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACOUSTIC_GUITAR } from '../../core/instruments/acousticGuitar'
import { fretWindowPositionSystem } from '../../core/fretboard/positions/fretWindow'
import { locationsForMidi, midiAt, type FretRange } from '../../core/fretboard/fretboard'
import { pitchClassName } from '../../core/theory/pitch'
import { computeGateDb } from '../../core/audio/noteTracker'
import { describeMistake, type ScaleAttemptState } from '../../core/exercises/scaleDeck'
import { useAudioEngine } from '../hooks/useAudioEngine'
import { MicPermissionGate } from '../components/MicPermissionGate'
import { LevelMeter } from '../components/LevelMeter'
import { Fretboard, type FretboardMark, type FretboardMarkStatus } from '../components/Fretboard'
import { SequenceStrip } from '../components/SequenceStrip'
import { ResultBanner } from '../components/ResultBanner'
import {
  createScaleDeckReducer,
  initScaleDeckState,
  DEFAULT_SCALE_DECK_OPTIONS,
} from './scaleDeckReducer'
import styles from './ScaleDeck.module.css'

const reducer = createScaleDeckReducer(ACOUSTIC_GUITAR, fretWindowPositionSystem)
const KEY_OPTIONS = Array.from({ length: 12 }, (_, pc) => pc)

function computeFretRange(position: number): FretRange {
  return { min: Math.max(0, position - 1), max: position + 4 }
}

function computeMarks(
  ascending: { string: number; fret: number }[],
  expected: number[],
  attempt: ScaleAttemptState,
  fretRange: FretRange,
): FretboardMark[] {
  const playedMidis = new Set(expected.slice(0, attempt.index))
  const currentMidi = expected[attempt.index]

  const marks: FretboardMark[] = ascending.map((loc) => {
    const midi = midiAt(ACOUSTIC_GUITAR, loc)
    const status: FretboardMarkStatus =
      midi === currentMidi ? 'current' : playedMidis.has(midi) ? 'correct' : 'upcoming'
    return { string: loc.string, fret: loc.fret, status }
  })

  const activeMistake = attempt.mistakes.filter((m) => m.index === attempt.index).at(-1)
  if (activeMistake) {
    for (const loc of locationsForMidi(ACOUSTIC_GUITAR, activeMistake.heardMidi, fretRange)) {
      marks.push({ string: loc.string, fret: loc.fret, status: 'wrong' })
    }
  }
  return marks
}

export function ScaleDeck() {
  const navigate = useNavigate()
  const engine = useAudioEngine()
  const [preferFlats, setPreferFlats] = useState(false)
  const [hideReadout, setHideReadout] = useState(false)
  const [state, dispatch] = useReducer(reducer, DEFAULT_SCALE_DECK_OPTIONS, (options) =>
    initScaleDeckState(ACOUSTIC_GUITAR, fretWindowPositionSystem, options),
  )

  const readingTimeRef = useRef(0)
  const { reading, onNoteEvent } = engine
  useEffect(() => {
    if (reading) readingTimeRef.current = reading.time
  }, [reading])
  useEffect(() => {
    if (reading) dispatch({ type: 'checkPause', now: reading.time })
  }, [reading])
  useEffect(() => onNoteEvent((event) => dispatch({ type: 'noteEvent', event })), [onNoteEvent])

  const status = state.session.attempt.status

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === ' ') {
        e.preventDefault()
        if (status === 'finished' || status === 'failed') {
          dispatch({ type: 'next', time: readingTimeRef.current })
        }
      } else if (e.key === 'Escape') {
        navigate('/decks')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [status, navigate])

  const fretRange = computeFretRange(state.options.position)
  const marks = computeMarks(state.ascending, state.expected, state.session.attempt, fretRange)
  const gateDb = engine.noiseFloorDb !== null ? computeGateDb(engine.noiseFloorDb) : undefined
  const positions = fretWindowPositionSystem.positions(ACOUSTIC_GUITAR)
  const lastMistake = state.session.attempt.mistakes.at(-1)

  return (
    <section>
      <h1>Major scale positions</h1>
      <p>Play the scale up and back down. Space = next attempt (once finished), Esc = back.</p>

      <fieldset className={styles.options}>
        <legend>Deck options</legend>
        <label>
          Key:{' '}
          <select
            value={state.options.keyPitchClass}
            onChange={(e) =>
              dispatch({
                type: 'setOptions',
                options: { keyPitchClass: Number(e.target.value) },
                time: readingTimeRef.current,
              })
            }
          >
            {KEY_OPTIONS.map((pc) => (
              <option key={pc} value={pc}>
                {pitchClassName(pc, { preferFlats })} major
              </option>
            ))}
          </select>
        </label>

        <label>
          Position:{' '}
          <select
            value={state.options.position}
            onChange={(e) =>
              dispatch({
                type: 'setOptions',
                options: { position: Number(e.target.value) },
                time: readingTimeRef.current,
              })
            }
          >
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label>
          <input
            type="radio"
            checked={state.options.mode === 'practice'}
            onChange={() =>
              dispatch({
                type: 'setOptions',
                options: { mode: 'practice' },
                time: readingTimeRef.current,
              })
            }
          />
          Practice
        </label>
        <label>
          <input
            type="radio"
            checked={state.options.mode === 'test'}
            onChange={() =>
              dispatch({
                type: 'setOptions',
                options: { mode: 'test' },
                time: readingTimeRef.current,
              })
            }
          />
          Test (strict)
        </label>

        <label>
          <input
            type="checkbox"
            checked={state.options.randomDrill}
            onChange={(e) =>
              dispatch({
                type: 'setOptions',
                options: { randomDrill: e.target.checked },
                time: readingTimeRef.current,
              })
            }
          />
          Random key/position drill
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
          <Fretboard instrument={ACOUSTIC_GUITAR} fretRange={fretRange} marks={marks} />
          <SequenceStrip
            expected={state.expected}
            currentIndex={state.session.attempt.index}
            mistakes={state.session.attempt.mistakes}
            preferFlats={preferFlats}
          />

          {!hideReadout && (
            <p className={styles.hearing}>
              Hz: {engine.reading?.hz?.toFixed(1) ?? '—'} · Clarity:{' '}
              {engine.reading?.clarity.toFixed(2) ?? '—'}
            </p>
          )}
          <LevelMeter rms={engine.reading?.rms ?? 0} gateDb={gateDb} />

          {status === 'paused' && (
            <p role="status">Listening paused. Play the next note to continue.</p>
          )}

          {status === 'failed' && lastMistake && (
            <ResultBanner
              correct={false}
              message={`${describeMistake(lastMistake, { preferFlats })} Retry?`}
            />
          )}

          {status === 'finished' && (
            <>
              <ResultBanner
                correct={true}
                message={
                  state.session.attempt.mistakes.length === 0
                    ? 'Clean run!'
                    : `Finished with ${state.session.attempt.mistakes.length} mistake(s).`
                }
              />
              {state.session.attempt.mistakes.length > 0 && (
                <ul className={styles.summary}>
                  {state.session.attempt.mistakes.map((m, i) => (
                    <li key={i}>{describeMistake(m, { preferFlats })}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => dispatch({ type: 'retry', time: readingTimeRef.current })}
            >
              Retry
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
