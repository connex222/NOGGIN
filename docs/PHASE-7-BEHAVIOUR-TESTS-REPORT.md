# Phase 7 — Code readability and behaviour-test continuation

## Changes

- Reformatted `public/tv/showcase.js` into short, readable statements and named helpers without changing its user-visible behaviour.
- Added `tests/showcase-behaviour.test.js` to execute the actual TV welcome-screen script in a small simulated DOM, covering Start, Join, focus, rules dialog, Escape, backdrop close, and updating QR/code/link from the active room.
- Replaced one brittle `showcase.test.js` assertion that required an exact variable name, since the real interaction is now covered by the new test suite.
- Kept all games, content and existing features intact.

## Automated verification

- `npm test`: 234 passed, 1 skipped, 0 failed (235 total).
- `npm run check`: passed.
- `npm run audit`: 104 checks, 0 errors.
- `node tools/simulate.js 300`: completed 300 per player count (2, 4, 6, 8) in One at a Time.
- `node tools/simulate.js 300 --everyone`: completed 300 per player count (2, 4, 6, 8) in Everyone Rolls.

## Outstanding concerns

- Two-player simulated halfway-leader win rates fluctuate beyond the originally targeted 60–65% band. Review balance with larger, reproducibly seeded samples before calling the balancing objective stable.
- Tests use a simulated DOM and do not replace actual TV, phone or accessibility testing.
- Phase 4 visual acceptance and Phase 6 factual review remain outstanding.
- Broader legacy long-line reformatting and conversion of other static tests are not yet complete.
- No production deployment or fresh npm installation has been verified in this pass.
