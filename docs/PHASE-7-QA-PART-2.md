# Phase 7 — Quality assurance, part 2 (20 October 2026)

## Changes
- Added `tests/bomb-clue-solvability.test.js`, checking that private clue scraps collectively reconstruct exactly the four wire colours and four-digit code, across 2–8 players and 100 deterministic seeds each (700 scenarios).
- No production gameplay rules or existing content were changed.

## Verification
- `npm test`: 237 passed, 1 skipped (238 total).
- `npm run check`: passed.
- `npm run audit`: passed (104 checks); **194** editorial review flags remain (23 buzzer, 99 fib, 72 bid).
- `node tools/simulate.js 1500`: 1,500 matches each at 2, 4, 6 and 8 players, all completed.
- `node tools/simulate.js 1500 --everyone`: 1,500 matches each at 2, 4, 6 and 8 players, all completed.

| Players | Sequential halfway-leader win % | Everyone Rolls halfway-leader win % | Everyone Rolls estimated minutes |
|---|---:|---:|---:|
| 2 | 61.1 | 59.0 | 34.4 |
| 4 | 49.5 | 42.6 | 38.3 |
| 6 | 41.8 | 35.8 | 39.9 |
| 8 | 30.3 | 24.3 | 34.7 |

These are deterministic model outputs with assumptions about player skill, choices and timing, not measured sessions; percentages should not be interpreted as exact win probabilities. No balancing change was made based on the narrow 1-point shortfall for two-player Everyone Rolls.

## Open acceptance items
- Original Phase 4 five-stage progression and 48px TV readability standards remain unproven for several encounters and Showdowns.
- The 194 review-flagged content entries have not been fact-checked and cleared against published sources.
- Real TV, remote, browser audio, phone reconnection, cross-house connectivity, eight-player and prolonged sessions are untested.
- Audio source and redistribution licences are unresolved.
- Further legacy formatting and conversion of text-only tests to behavioural tests remain.
