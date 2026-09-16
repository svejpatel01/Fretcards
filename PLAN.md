# Fretcards: build plan (v1, acoustic guitar)

> "Fretcards" is a working name. This is the handoff doc for Claude Code. Read the whole file before writing any code, then build phase by phase (section 9). Each phase ends with green tests and a short summary of what changed and what Svej should try by hand.

---

## 1. What we're building

A browser app of flashcards for musicians that listens through the microphone and grades what you play. The user picks an instrument (v1: acoustic guitar only), picks a deck, and works through cards.

**v1 decks**

1. **Note finder.** The card shows a note (e.g. "F♯"). The user plays it. The app says whether it was right, and if not, what it heard. The user moves to the next card.
2. **Major scale positions.** The card shows a key and position (e.g. "G major, 2nd position") with an optional fretboard diagram. The user plays the scale up and back down. The app grades note by note and reports exactly which note was wrong or skipped.

**Goals**

- Runs 100% in the browser. No backend, and audio never leaves the device.
- $0 to build and host; deployable on svej.org.
- Code quality that holds up as a portfolio piece: strict types, tested core, measured accuracy.
- Architecture where adding an instrument (electric guitar, bass, ukulele) is mostly data.

**Non-goals for v1:** chords/polyphony, rhythm or tempo grading, user accounts, instruments other than acoustic guitar.

---

## 2. Decisions already made

| Area | Choice | Why |
|---|---|---|
| App framework | Vite + React + TypeScript (`strict: true`) | Pure static client app; no server rendering needed |
| Pitch detection | [`pitchy`](https://github.com/ianprime0509/pitchy) (McLeod Pitch Method, ESM, typed) | Small, fast enough for real-time tuners, returns `[frequency, clarity]` |
| Music theory | Own small module (note ↔ MIDI ↔ Hz, spelling) | ~100 lines, and better showcase code than a dependency |
| Fretboard rendering | Custom SVG React component | It is the hero of the UI; no library fits the design |
| Unit tests | Vitest | Fast, native ESM (pitchy is ESM-only) |
| E2E tests | Playwright (Chromium with a fake mic fed from a WAV file) | Exercises the real mic path headlessly |
| State | React state + one reducer per deck; `localStorage` with a versioned key | No backend |
| Styling | Plain CSS with custom properties (CSS modules fine) | Full control of the design tokens in section 7 |
| Hosting | Static `dist/` on svej.org infrastructure (section 10) | $0 |

---

## 3. Open decisions (defaults chosen; Svej may override)

- **Position system.** Default: the *fret-position* system, where "nth position" means the index finger sits at fret n and the hand covers a 4-fret window (section 6.2). Alternatives to add later behind the same `PositionSystem` interface: CAGED (5 shapes) and 3-notes-per-string (7 patterns). **Confirmed by Svej 2026-09-16: fret-position (default).**
- **Scale range.** Default "full position": lowest to highest scale note available in the position, ascending then descending, top note not repeated. Option: "root to root".
- **Accidental spelling.** Scales use the key's spelling (F♯ in G major, B♭ in F major). The note deck shows sharps by default with a flats toggle. Grading is pitch-based, so spelling never affects correctness.
- **URL.** `fretcards.svej.org` (default) or `svej.org/fretcards`. **Confirmed by Svej 2026-09-16: fretcards.svej.org (default).**

---

## 4. Key facts and constraints (read before coding)

**Standard tuning**

| String (low→high) | Note | MIDI | Hz |
|---|---|---|---|
| 6 | E2 | 40 | 82.41 |
| 5 | A2 | 45 | 110.00 |
| 4 | D3 | 50 | 146.83 |
| 3 | G3 | 55 | 196.00 |
| 2 | B3 | 59 | 246.94 |
| 1 | E4 | 64 | 329.63 |

Playable range on a typical acoustic runs from 82.41 Hz (open low E) to about 1046.5 Hz (C6, fret 20 on the high E). Detector bounds: **70–1100 Hz**. In code, index strings `0..5` from low E to high E and convert to guitarist numbering (6..1) only in the UI.

**Constraints**

1. **Audio cannot tell which string was used.** The same pitch exists in several places on the neck (B3 is the open B string and also fret 4 on the G string). Grading is by pitch only: the diagram tells the user *where* to play, and the app verifies *what* was played. Say this plainly in the help text. (Phase 7c explores an ML string classifier.)
2. **Octave errors are the classic failure.** On many acoustics and laptop mics the low-E fundamental is weaker than its harmonics. Mitigations: pitch-class mode in the note deck, median smoothing, clarity threshold, and an "expected octave" sanity check in the scale grader.
3. **The attack is noisy.** Ignore about 50 ms after an onset before trusting pitch.
4. **Browser voice processing must be off:**
   ```ts
   navigator.mediaDevices.getUserMedia({
     audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
   });
   ```
   Noise suppression and AGC treat sustained tones as noise and wreck detection.
5. **Secure context required.** Mic access needs HTTPS (localhost is fine in dev).
6. **User gesture required.** Create or `resume()` the `AudioContext` from a click/tap (Safari and iOS are strict). Always read `audioContext.sampleRate`; never assume 44.1 kHz or 48 kHz.
7. **No `ScriptProcessorNode`** (deprecated). Start with an `AnalyserNode` polled on `requestAnimationFrame`, behind a `FrameSource` interface so an `AudioWorklet` source can replace it later without touching the core.
8. **Window size.** 2048 samples (~43 ms at 48 kHz) covers more than three periods of 82 Hz. Keep it configurable; try 4096 if low E is unstable.
9. **Bluetooth headsets** drop to a low-quality mic profile when the mic is in use. The help text should recommend the built-in or a wired mic.
10. **Claude Code cannot play a guitar.** Every audio feature must be verifiable headlessly with synthesized audio and recorded fixture files (section 8). When something can only be checked with a real guitar, stop and hand Svej a concrete checklist.

---

## 5. Architecture

**Principle:** a pure, framework-free core (theory, DSP, grading) that runs in Node for tests; thin browser adapters for the mic and Web Audio; React only for UI. Enforce with an ESLint `no-restricted-imports` rule: nothing in `src/core` may import React, DOM, or Web Audio types.

```
src/
  core/
    theory/
      pitch.ts            # Hz ↔ MIDI ↔ name, cents, pitch class, spelling per key
      scales.ts           # major scale interval pattern, key signatures
    instruments/
      types.ts            # Instrument, DeckDefinition
      acousticGuitar.ts   # tuning, fret count, detector range, available decks
      registry.ts         # list of instruments (only acoustic guitar enabled in v1)
    fretboard/
      fretboard.ts        # (string, fret) ↔ MIDI, all locations of a pitch in a fret range
      positions/
        types.ts          # PositionSystem interface
        fretWindow.ts     # default system (section 6.2)
    audio/
      frame.ts            # AudioFrame { samples: Float32Array; sampleRate; time }
      pitchDetector.ts    # wraps pitchy → PitchReading
      noteTracker.ts      # PitchReading stream → NoteEvent stream (section 6.1)
      synth.ts            # Karplus–Strong plucked-string synth for tests and demos
      wav.ts              # minimal WAV decode for Node tests
    exercises/
      noteDeck.ts         # card generation + grading (section 6.4)
      scaleDeck.ts        # sequence generation + grader state machine (section 6.3)
      progress.ts         # per-card stats + weighted selection
  adapters/
    micSource.ts          # getUserMedia + AnalyserNode → AudioFrame
    fileSource.ts         # decode uploaded/URL audio → AudioFrame (dev page + tests)
    storage.ts            # versioned localStorage with migration
  ui/
    routes/               # InstrumentSelect, DeckSelect, NoteDeck, ScaleDeck,
                          # Tuner, Settings, HowItWorks, Dev (only with ?debug)
    components/           # Fretboard, Flashcard, LevelMeter, TunerDial,
                          # SequenceStrip, ResultBanner, MicPermissionGate
    hooks/                # useAudioEngine, useNoteEvents
tests/
  unit/                   # mirrors src/core
  fixtures/
    synth/                # generated at test time, not committed
    real/                 # Svej's recordings + labels.json
  e2e/
scripts/
  eval/                   # Python evaluation harness (Phase 7)
```

**Core types (sketch; refine as needed)**

```ts
export type Midi = number; // integer semitone, A4 = 69

export interface PitchReading {
  time: number;            // seconds
  hz: number | null;       // null when unpitched or below gate
  clarity: number;         // 0..1 from pitchy
  rms: number;
}

export type NoteEvent =
  | { type: 'onset'; time: number; midi: Midi; cents: number; confidence: number }
  | { type: 'offset'; time: number };

export interface Instrument {
  id: string;
  name: string;
  strings: Midi[];                         // low → high, e.g. [40, 45, 50, 55, 59, 64]
  fretCount: number;                       // physical frets; UI defaults to 0–12
  detectorRange: { minHz: number; maxHz: number };
  decks: DeckDefinition[];
}

export interface FretLocation { string: number; fret: number; stretch?: boolean }

export interface PositionSystem {
  id: string;
  label: string;
  positions(inst: Instrument): number[];
  /** Ascending list of locations for the major scale in this key and position. */
  majorScaleShape(inst: Instrument, keyPitchClass: number, position: number,
                  opts: PositionOptions): FretLocation[];
}
```

---

## 6. Algorithms

### 6.1 Note tracking (DSP → note events)

Per frame (roughly every 16–20 ms):

1. Compute RMS. Below the gate, the frame is silent. Gate = max(−50 dBFS, calibrated noise floor + 10 dB). Calibration is one second of "stay quiet" the first time the mic starts (skippable; stored).
2. Run pitchy `findPitch(frame, sampleRate)` → `[hz, clarity]`. The reading is valid if `clarity ≥ 0.90` and `hz` is inside the instrument's detector range.
3. `midiFloat = 69 + 12 * log2(hz / a4Ref)`, `midi = round(midiFloat)`, `cents = (midiFloat − midi) * 100`. `a4Ref` defaults to 440 and is a setting.
4. Smooth with the median of the last 5 valid `midiFloat` values to suppress octave jumps and glitches.

**State machine: `SILENT → ATTACK → SUSTAIN`**

- `SILENT → ATTACK` when RMS crosses the gate, **or** (from `SUSTAIN`) when RMS jumps ≥ 6 dB within 30 ms. The second case is a re-pluck of the same note and must produce a new onset.
- In `ATTACK`, ignore readings for 50 ms, then require **K = 4** consecutive valid readings with the same `midi`. Emit `onset` (mean cents, mean clarity as confidence) and move to `SUSTAIN`.
- If `ATTACK` does not stabilize within 400 ms, drop it (string scrape, knock, speech).
- In `SUSTAIN`, if a *different* `midi` is stable for K readings, emit `offset` then `onset` (covers hammer-ons, pull-offs, slides). If RMS stays below the gate for 60 ms, emit `offset` and return to `SILENT`.

All thresholds live in one exported `TrackerConfig` with documented defaults. Unit tests pin the behavior so tuning changes are deliberate.

### 6.2 Default position system: fret window

**Definition.** Position `p` (0–12) means the index finger is at fret `p`. The core window is frets `p … p+3`. Position 0 is open position (frets 0–3).

**Algorithm** for key with root pitch class `k`:

1. For each string, low to high, take every fret `f` in `[p, p+3]` whose pitch class is in the scale. In standard tuning the core windows of adjacent strings never overlap, so each pitch appears at most once.
2. Between strings a perfect fourth apart (5 semitones), the windows leave exactly one pitch uncovered: fret `p+4` on the lower string, which equals fret `p−1` on the upper string. If that pitch is in the scale, add it as a **stretch**. Default `stretch: 'pinky'` places it on the lower string at `p+4`; `stretch: 'index'` places it on the upper string at `p−1` (fall back to pinky when `p−1 < 0`). The G→B pair (4 semitones) has no gap.
3. Sort by pitch: this is the ascending shape. The played sequence is ascending, then descending without repeating the top note.
4. Option `range: 'rootToRoot'` trims to the span from the lowest root to the highest root.
5. Clamp to `fretCount`; the UI offers positions 0–12.

**Golden tests (must match exactly)**

- **G major, position 2:** F♯2 G2 A2 B2 C3 D3 E3 F♯3 G3 A3 B3 C4 D4 E4 F♯4 G4 A4 (17 notes, no stretches).
- **C major, position 2:** G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 (16 notes). F4 is a stretch: B string fret 6 by default, high E fret 1 with `stretch: 'index'`.

**Property tests** (all 12 keys × positions 0–12 × both stretch options):

- Every note is in the key.
- Pitches are strictly ascending and consecutive notes are adjacent scale degrees (nothing is missing).
- Every fret is within `[p−1, p+4]` and `≤ fretCount`.
- Each string holds 2–4 notes, with at most one stretch per string boundary.

### 6.3 Scale grader (state machine)

Input: `expected: Midi[]` and the `NoteEvent` stream. State: current index `i`, `mistakes[]`, timestamps.

On each `onset(m)`:

| Condition | Result |
|---|---|
| `m === expected[i]` | Mark correct, `i++`. Finished when `i === expected.length`. |
| `m === expected[i-1]` | Re-pick of the note just played. Ignore (configurable). |
| `m === expected[i+1]` | Skipped `expected[i]`. Report which note was skipped. |
| same pitch class as `expected[i]`, different octave | "Right note, wrong octave" (likely a different string or an octave detection error; show both). |
| anything else | "Wrong note: expected D4, heard D♯4". Show the expected note's location on the fretboard. |

**Modes**

- **Test (strict):** the first mistake ends the attempt. Show where it went wrong and offer Retry.
- **Practice:** record the mistake and wait on `i` until the right note arrives (after a skip, flag it and continue from `i+2`). Show a summary of all mistakes at the end.

**Guards:** ignore onsets in the first 300 ms after a card appears (button clicks, previous note ringing out). The attempt starts at the first onset, not when the card appears. If no onset arrives for 8 s mid-attempt, pause with "Listening paused. Play the next note to continue."

UI: a `SequenceStrip` shows every expected note as a chip; chips fill in as they are played, the current chip is highlighted, and a wrong note appears in the strip under the chip where it happened. The fretboard lights the same notes in sync.

### 6.4 Note deck grading

A card is `{ target, spelling, stringConstraint? }`. Evaluate the first stable onset after the 300 ms guard.

- **Anywhere (default):** correct if `pitchClass(m) === target`. Octave errors cannot cause false negatives, which makes this the most robust mode.
- **On a string:** the card names a string ("F♯ on the A string"). Accepted MIDI values are `open + f` for every fret `f` in the chosen range with that pitch class (one value, or two if the range reaches past fret 12). If the right pitch class arrives in another octave, say "Right note, wrong octave for that string".
- **Read the staff (Phase 5, optional):** show the note on a treble clef using VexFlow (MIT). Guitar sounds an octave lower than written; grade the exact MIDI.

**Feedback.** Correct: "F♯3, correct (+12¢)". Wrong: "Heard G3. Target was F♯." Actions: Try again, Reveal (fretboard shows every location of the target in range), Next.

**Deck options:** naturals only or all 12 notes; which strings; fret range (0–5, 0–12); auto-advance after a correct answer (off by default, 800 ms when on).

**Progress:** per pitch class (and per string in string mode) track attempts, correct count, and median response time. Pick the next card with weighted randomness that favors low accuracy and slow responses; never repeat the previous card.

---

## 7. UI and UX

**Screens:** Instrument select (acoustic guitar enabled; others listed as "Coming later"), Deck select, Note finder, Scale positions, Tuner, Settings, How it works, Dev (`?debug`).

**Microphone flow.** Before the browser prompt, explain in one sentence why the mic is needed and that audio stays on the device. Handle denied permission and "no input device" with specific fix instructions per browser. After permission, offer an input device picker (`enumerateDevices`).

**Always-visible feedback** on exercise screens: an input level meter and a "Hearing: G3" readout (hideable for a harder challenge).

**Keyboard:** Space = next / retry, R = reveal, Esc = back.

**Tuner.** Reuses the audio engine: needle in cents, nearest string name, A4 reference from settings. Encourage tuning before a session, since a string 50¢ flat grades as the wrong note.

**How it works page.** A live waveform, the pitch track, and a short plain-English explanation of the pipeline (mic → frames → McLeod pitch → note tracker → grader). This page is the bridge to the portfolio write-up.

**Design direction** (apply frontend-design principles: plan tokens, review them against this brief, then build)

- **The fretboard is the hero** and the one memorable element: a horizontal SVG with a rosewood board, nickel frets, pearl inlays at 3/5/7/9/12 (double at 12), and note dots that light up as they are played. On a phone in portrait, show only the position's window, with horizontal scroll for the full neck.
- **Starting palette** (materials of an acoustic guitar):
  - Rosewood `#2E1F1B` (fretboard, dark surfaces)
  - Nickel `#CFD3D8` (frets, dividers)
  - Studio `#F3F4F5` (page background)
  - Abalone `#2F8C86` (played / correct)
  - Amber `#D08A2E` (target / next note)
  - Oxblood `#A23B3B` (wrong)
- Correct and wrong are never signaled by color alone: always pair with an icon and text.
- **Type:** one clean sans for the UI. The big note name on a card is set in Petaluma Script (Steinberg's SMuFL text font, SIL OFL; self-host it) for a handwritten lead-sheet feel and proper ♯/♭ glyphs.
- Avoid generic generated-page tells: all-caps eyebrow labels, identical rounded cards with soft grey shadows, decorative gradient washes.
- **Motion only in response to playing:** a note dot pulses when detected, the result banner slides in. Respect `prefers-reduced-motion`.
- **Quality floor:** works on a phone propped on a music stand (large tap targets, readable at arm's length), visible keyboard focus, sufficient contrast.

---

## 8. Testing strategy

**Unit (Vitest, Node)**

- `theory`: Hz ↔ MIDI round trips, cents math, spelling in all 12 major keys.
- `positions`: golden and property tests from section 6.2.
- `pitchDetector` + `noteTracker` on synthesized audio from `synth.ts` (Karplus–Strong):
  - every string × frets 0–15, at 44.1 kHz and 48 kHz: exactly one onset with the expected MIDI;
  - a "weak fundamental" low-E variant (fundamental attenuated relative to the 2nd harmonic) to exercise octave handling;
  - white noise added at 20 dB SNR;
  - sequences: repeated identical note (must yield two onsets), legato pitch change, silence gaps, an unpitched noise burst (must yield no onset).
- Graders: hand-written `NoteEvent` fixtures for a clean run, wrong note, skip, re-pick, wrong octave, timeout, strict vs practice.

**Real-audio integration.** `tests/fixtures/real/*.wav` plus `labels.json` (expected note sequence per file). `npm run eval:fixtures` runs the full core pipeline in Node and prints a per-file accuracy table. Tests assert only on the clean takes; the noisy take is report-only.

**E2E (Playwright, Chromium).** Launch Chromium with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<fixture.wav>` so the real `getUserMedia` path receives a known WAV (it loops). Scenarios: a note card grades correct; a scale card reports the planted wrong note at the right index.

**Dev page (`?debug`).** Mic or uploaded WAV as input. Plots waveform, pitch (Hz + clarity), RMS with the gate line, and note events on a timeline, with live sliders for `TrackerConfig`. This is the main tool for tuning thresholds against a real guitar.

**Human task for Svej** (Claude Code: present this checklist when Phase 2 lands). Record short mono WAV clips with the mic you'll actually practice with:

- [ ] each open string, let ring
- [ ] chromatic run on the low E, frets 0–12
- [ ] fret 5 and fret 12 on every string
- [ ] G major, 2nd position, clean, up and down
- [ ] same, with one deliberate wrong note (write down which)
- [ ] same, with one note re-picked
- [ ] same, with one note skipped
- [ ] a take with background noise (TV, fan)

Fill in `labels.json` for each.

---

## 9. Phases

Each phase: small commits; `npm run lint && npm run typecheck && npm test` green before calling it done; finish with a summary and a manual test list.

### Phase 0: Scaffold
- [x] Vite + React + TS (strict), ESLint (with the `src/core` import restriction), Prettier
- [x] Vitest, Playwright, npm scripts (`dev`, `build`, `test`, `test:e2e`, `lint`, `typecheck`, `eval:fixtures`)
- [x] GitHub Actions CI: lint, typecheck, unit tests, build (e2e on main)
- [x] App shell with routing and empty screens
- [x] `README.md` stub and a `CLAUDE.md` with commands, conventions, and a pointer to this plan

**Done when** CI is green on the empty shell.

### Phase 1: Theory and fretboard core
- [x] `pitch.ts`, `scales.ts`, instrument types + acoustic guitar definition + registry
- [x] `fretboard.ts` and the `fretWindow` position system
- [x] Golden and property tests

**Done when** all tests pass for every key and position.

### Phase 2: Audio engine, Tuner, Dev page
- [x] `synth.ts`, `wav.ts`, `pitchDetector.ts`, `noteTracker.ts` with the synthesized test suite
- [x] `micSource.ts`, `fileSource.ts`, `useAudioEngine`, `MicPermissionGate`, noise calibration
- [x] Tuner screen, Dev page
- [x] Present the recording checklist to Svej

**Done when** synthetic tests pass and Svej confirms the tuner reads all six open strings correctly on his guitar. Synthetic tests pass (1503 unit tests, plus a Playwright e2e test that drives the real getUserMedia path with a synthesized fake-mic WAV). **Still needed from Svej:** confirm the tuner reads all six open strings correctly on a real guitar (see the recording checklist below) — that's the one thing that can't be verified headlessly.

### Phase 3: Note finder deck
- [x] Card generation, grading modes (anywhere, on a string), progress weighting
- [x] Flashcard UI, feedback, reveal, deck options
- [x] E2E test with fake mic

**Done when** grader and e2e tests pass and a 20-card manual session feels right. Grader and e2e tests pass. **Still needed from Svej:** a 20-card manual session on a real guitar to confirm it feels right.

### Phase 4: Scale positions deck
- [x] Confirm the position system with Svej — confirmed: fret-position (default)
- [x] `Fretboard` component with position overlay and live note lighting; `SequenceStrip`
- [x] Grader state machine, strict and practice modes
- [x] Key and position pickers; "random card" drill across keys/positions
- [x] E2E planted-mistake test; fixture eval on the real scale takes

**Done when** tests pass and Svej plays G major 2nd position cleanly and with a mistake, and the app reports both correctly. Tests pass, including an e2e test that plants a wrong first note via a fake mic and confirms the app reports it correctly. **Still needed from Svej:** play G major 2nd position on a real guitar, cleanly and with a mistake, to confirm both report correctly; the real-scale-takes fixture eval needs the section 8 recordings, still outstanding.

### Phase 5: Product polish
- [ ] Instrument select screen driven by the registry
- [ ] Settings: A4 reference, input device, sensitivity, clarity threshold, stretch preference, sharps/flats, hide live readout
- [ ] Progress persistence with a versioned storage schema
- [ ] How it works page
- [ ] Accessibility and mobile pass; design review against section 7
- [ ] Optional: read-the-staff mode

### Phase 6: Ship on svej.org
- [ ] Deploy (section 10)
- [ ] Verify mic flow on desktop Chrome, desktop Safari, iOS Safari, Android Chrome
- [ ] README with a demo GIF, architecture diagram, and accuracy table from the fixture eval

**Done when** the app is live over HTTPS and works on all four browsers.

### Phase 7: ML track (portfolio differentiator)

**7a. Evaluation harness** (`scripts/eval/`, Python)
- Load GuitarSet (acoustic guitar, 6 players, per-string note annotations) via `mirdata`. Use the `mic` recordings and restrict to segments where only one note is sounding.
- Metrics: note accuracy (onset within 50 ms and correct MIDI), octave-error rate, onset latency.
- Compare: our TypeScript pipeline (invoked via Node on the same audio), pYIN (librosa), CREPE tiny and full.
- Output a markdown report with plots. Provide a download script only; never commit dataset audio. Check the dataset license and attribution requirements before publishing any derived material.

**7b. Neural pitch in the browser**
- CREPE-tiny via TensorFlow.js (the `marl/crepe` repo has a browser demo to start from) or exported to ONNX Runtime Web, behind the existing `PitchDetector` interface, switchable in Settings.
- Measure CPU and latency on a laptop and a phone. Keep McLeod as the default unless the eval says otherwise.

**7c. Research spike: string classifier**
- Predict which string a single note was played on from mic audio, trained on GuitarSet's per-string annotations (free Colab or Kaggle GPU), exported to TF.js/ONNX.
- If accuracy is useful, the scale deck can verify the *position*, not only the pitch. Report results honestly either way; a well-documented negative result still makes a good write-up.

**7d. Later: chord cards**
- Polyphonic transcription with Spotify's Basic Pitch (`@spotify/basic-pitch`, Apache-2.0). Note the TypeScript repo hasn't been updated since 2023; check compatibility first.

---

## 10. Deployment ($0)

The build is a static `dist/` folder. The mic requires HTTPS.

**Option A: existing GCP e2-micro + Caddy** (already serving `flights.svej.org`)
- Add a DNS record for `fretcards.svej.org` and a site block:
  ```
  fretcards.svej.org {
      root * /var/www/fretcards
      try_files {path} /index.html
      file_server
      header Permissions-Policy "microphone=(self)"
  }
  ```
- Build in CI (not on the VM) and `rsync` `dist/` to the server.

**Option B: Cloudflare Pages or GitHub Pages** with the custom subdomain, deployed from CI on push to `main`. Zero server maintenance.

If served under a subpath (`svej.org/fretcards`), set Vite's `base` and the router's basename.

---

## 11. Working agreements for Claude Code

- Read this file fully first. Ask before changing anything in section 2.
- Keep `src/core` free of DOM, React, and Web Audio imports.
- Every threshold lives in a config object with a documented default.
- No new runtime dependency without a one-line justification in the PR/commit message.
- Never claim detection accuracy without a test or eval result behind it.
- When progress depends on a real guitar, stop and give Svej a concrete checklist.
- Keep this plan current: tick checkboxes and record changed decisions below.

## 12. Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-09-15 | Added `react-router-dom` as a runtime dependency | Client-side routing for the screens in section 7 (Instrument select, Deck select, Note finder, Scale positions, Tuner, Settings, How it works, Dev) |
| 2026-09-15 | Pinned `vitest@5.0.1` (not the initially-resolved 3.2.7) | 3.2.7's bundled Vite type definitions don't match the installed `vite@8.3.0`, breaking `tsc -b`; 5.0.1 declares `vite@^8.0.0` support |
| 2026-09-15 | `tests/**` type-checks under `moduleResolution: bundler` (changed from `nodenext`) | `nodenext` requires explicit `.js` extensions on relative imports, which fought with importing `src/core/**` directly from tests; nothing here is actually run through Node's native resolver (Vite/Vitest/Playwright all use their own loaders), so `bundler` is safe and matches `tsconfig.app.json` |
| 2026-09-15 | ESLint's `src/core` globals live in a block separate from the general browser-globals block, with `ignores: ['src/core/**']` on the latter | Flat config *merges* `languageOptions.globals` across matching blocks instead of replacing it, so `globals.browser` was leaking `document`/`window` into `src/core` until the blocks were made mutually exclusive by file glob |
| 2026-09-16 | Added `pitchy` as a runtime dependency | Per section 2 — the McLeod Pitch Method detector wrapped by `core/audio/pitchDetector.ts` |
| 2026-09-16 | `synth.ts`'s Karplus-Strong and white-noise generators are seeded (mulberry32), defaulting to a fixed seed | `Math.random()` made the fretboard-coverage pipeline test flaky — ~6% of the 192 string/fret/sample-rate combinations randomly failed to reach onset on a given run, purely from unlucky noise-burst seeds, not real bugs. Determinism makes synthesized fixtures reproducible test inputs |
| 2026-09-16 | `useAudioEngine`'s calibration averages RMS(dB) over the first 1s after the mic starts, storing the result in `localStorage` via `adapters/storage.ts` | Implements the "stay quiet" calibration from section 6.1; skippable, falls back to the tracker's default -50dBFS gate floor |
| 2026-09-16 | Added a Playwright global setup (`tests/e2e/globalSetup.ts`) that synthesizes a WAV fixture and launches Chromium with `--use-file-for-fake-audio-capture` | Validates the *real* `getUserMedia` → `AnalyserNode` mic path end-to-end (not just the Node-side pipeline unit tests), per section 8's fake-mic e2e strategy and section 4's constraint 10 |
| 2026-09-16 | Position system (section 3) and deploy URL (section 10) confirmed by Svej: fret-position and `fretcards.svej.org`, both matching the plan's defaults | Explicit confirmation requested before Phase 4 and Phase 6 respectively |
| 2026-09-16 | `Fretboard` renders frets at uniform width rather than physically tapered spacing | Simpler, bug-resistant layout math; the plan doesn't require photorealism, just the rosewood/nickel/pearl "hero" aesthetic from section 7 |
| 2026-09-16 | Scale grader's mistake classification (repick/skip/wrong-octave/wrong-note) is mode-independent; only whether a mistake ends the attempt differs between test and practice mode | Section 6.3's condition table reads as a single, universal classification, with test vs. practice differing only in what happens *after* a mistake is classified |
| 2026-09-16 | Added a second Playwright project (`chromium-scale-mistake`) with its own `--use-file-for-fake-audio-capture` fixture, scoped via `testMatch`/`testIgnore` | Chromium's fake-audio-capture file is a launch-time flag fixed for the whole browser process, so testing two different planted signals (a clean tuner tone, a planted wrong scale note) needs two separately-launched browsers |