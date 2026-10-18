# NOGGIN v2 — Dice Theatre release check

- Node.js automated tests: **178 passed, 0 failed, 1 skipped**.
- Source checks: `npm run check` passed.
- Static release audit: **104 checks passed, 0 errors**.
- Browser mock: 1280×720, 1366×768, 1920×1080; 36 live spaces, players, 3D tumbling/reveal, catch-up two-dice roll, repeated state and Reduce Motion. No page errors, horizontal or vertical overflow.
- Result, dice values and token movement come from existing server state; the animation never randomises an outcome.
- One live HTTP test needs locally installed dependencies; **no real TV-to-phone multiplayer round was verified** in this release.

# NOGGIN v2 — Board redesign validation

- Node.js suite: **173 passed** in the preceding board-only release (historical result).
- `npm run check`: passed JavaScript syntax checks.
- `npm run audit`: 104 checks; **0 errors**.
- Mock browser viewports: **1280×720, 1366×768, 1920×1080**.
- Mock state coverage: 8-player board, 2-player board and Odd Spot challenge overlay; 36 live board spaces; 8 and 2 dynamically positioned contestant tokens; no browser page errors, horizontal or vertical overflow.
- Images/screenshots generated from browser mock data; **not live phone multiplayer or a Render deployment**.
- 60 editorial-review-pending Fib Factory facts remain pending from the incoming build.

Previous test notes and release history remain in other project documents.
