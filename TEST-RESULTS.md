# NOGGIN v1.2 — test results (18 October 2026)

- **129/129** Node automated tests passed (`npm test`).
- **104/104** static audit checks passed (`npm run audit`); 60 Fib Factory editorial facts remain flagged.
- JavaScript `npm run check` passed.
- 4,000/4,000 seeded synthetic matches finished (`node tools/simulate.js 1000`), with estimated average durations 25.3 min (2 players), 27.6 min (4 players), 31.8 min (6 players), 31.2 min (8 players). These are model assumptions, not timed human play sessions.
- Mocked Chromium TV/phone layout suite (`python tools/showrunner-browser-smoke.py`) passed at 1280×720, 1920×1080, 360×640 and 430×932. No uncaught browser exceptions or horizontal overflow reported.
- In-process gateway rehearsal verified room creation, joining, readying, rolling, mini-game intro/outcome, host pause/resume, phone disconnect/reconnect, skip, host-only JSON reporting, eight-player same-IP joins and privacy limits.
- Important bug fixed: minigame selections after landing ignored the injected random number generator, making some tests nondeterministic.
- `npm install --no-audit --no-fund --fetch-retries=0 --fetch-timeout=8000 --ignore-scripts` failed with `EAI_AGAIN registry.npmjs.org`. Therefore **live Express and Socket.IO transport tests are not performed**.
- Real network multiplayer, Render/Oracle production deployments, human pacing feedback and 60 editorial Fib facts remain **unverified**.

The gateway mock is not a substitute for the actual network stack. No claim of 9.5/10 entertainment quality is made.
