# CLAUDE.md

Read [PLAN.md](./PLAN.md) in full before making changes — it is the handoff doc and source of
truth for architecture, algorithms, and the phase-by-phase build order. This file only covers
day-to-day conventions.

## Commands

```bash
npm run dev            # dev server
npm run build            # typecheck + production build
npm test                 # unit tests (Vitest, Node)
npm run test:e2e         # e2e tests (Playwright, Chromium, fake mic)
npm run lint              # ESLint
npm run typecheck        # tsc, no emit
npm run eval:fixtures     # real-audio fixture accuracy report (Phase 7)
```

Before calling any phase done: `npm run lint && npm run typecheck && npm test` must be green
(and `npm run build` for anything touching the build). Small commits per phase.

## Conventions

- `src/core` is pure and framework-free: no React, DOM, or Web Audio imports. It must keep
  running under Node for unit tests. Enforced by the `no-restricted-imports` /
  `no-undef` ESLint rules scoped to `src/core/**` in `eslint.config.js`.
- TypeScript strict mode is on; keep it on.
- Every DSP/grading threshold lives in an exported, documented config object (e.g.
  `TrackerConfig`), not a magic number inline.
- No new runtime dependency without a one-line justification in the commit message.
- Never claim detection accuracy without a test or eval result behind it.
- When progress depends on a real guitar (recordings, manual verification), stop and hand
  Svej a concrete checklist rather than guessing.
- Plain CSS with custom properties (CSS modules are fine); design tokens are in
  `src/index.css`. See PLAN.md section 7 for the palette and design direction.

## Working through phases

Follow PLAN.md section 9 in order. Each phase ends with a short summary of what changed and a
manual test list for Svej to try by hand. Update the checkboxes in PLAN.md and the decision
log (section 12) as work lands or defaults change.
