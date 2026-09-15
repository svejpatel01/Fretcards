# Fretcards

Flashcards for musicians that listen through the microphone and grade what you play. v1
targets acoustic guitar with two decks: note finder and major scale positions. Runs 100% in
the browser — no backend, and audio never leaves the device.

See [PLAN.md](./PLAN.md) for the full design and build plan, and [CLAUDE.md](./CLAUDE.md) for
conventions when working on this repo with Claude Code.

## Status

Phase 0 (scaffold) is in progress. See PLAN.md section 9 for the phase list.

## Commands

```bash
npm run dev            # start the dev server
npm run build           # typecheck + production build
npm run preview         # preview the production build
npm test                # unit tests (Vitest)
npm run test:e2e        # e2e tests (Playwright, Chromium)
npm run lint             # ESLint
npm run typecheck       # tsc, no emit
npm run eval:fixtures    # real-audio fixture accuracy report (Phase 7)
```
