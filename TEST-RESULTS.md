# NOGGIN v1.3.0 — actual verification (18 October 2026)

**Status: release candidate.** This file distinguishes executed checks from tests that could not be run. The development environment was Linux with **Node.js v22.16.0**, **npm 10.9.2**, and headless Chromium; **Node.js 20, Windows, real mobile devices, Render, and Oracle were not tested** here.

## Commands actually run after the final code changes

| Command | Actual outcome |
|---|---|
| `npm test` | **PASS:** 167 total tests, **166 passed, 0 failed, 1 skipped**; approximately 0.64 s. Baseline uploaded ZIP had 144 tests (143 passed, 1 skipped). New tests cover timers, QR port and Classic/server privacy restrictions. |
| `npm run check` | **PASS** (exit status 0): Node syntax checks for the configured server, client, and tools scripts. |
| `npm run audit` | **PASS** (exit status 0): **104 static checks**, no errors; 60 Fib Factory entries still marked for editorial review. A static audit does not guarantee runtime behaviour. |
| `node tools/simulate.js 1000` | **PASS:** 4,000 / 4,000 synthetic games completed, 1,000 per player count 2, 4, 6, 8. |

### Simulation details (model estimates, not real play time)

| Players | Completed | Average turns | Estimated game duration |
|---|---:|---:|---:|
| 2 | 1,000 / 1,000 | 20.9 | 26.1 min |
| 4 | 1,000 / 1,000 | 22.5 | 28.2 min |
| 6 | 1,000 / 1,000 | 26.4 | 33.0 min |
| 8 | 1,000 / 1,000 | 25.4 | 31.7 min |

### Browser screenshots — mock state only

Executed `python tools/release-ui-smoke.py` using locally installed headless Chromium and **inline HTML/styles/scripts plus a simulated Socket.IO interface**. This exercises browser rendering and client presentation **without starting Express, making genuine socket connections, or playing turns**. Evidence is in `docs/previews/release-ui-mock-results.json`.

- 4-player and 8-player TV board at **1920×1080** and **1280×720**: four screenshots.
- Phone Odd Spot at **360×640** and **430×932**: two screenshots; 36 numbered cells each, all measured at least **44×44 CSS pixels**.
- TV Sketch & Sabotage at **1920×1080** and **1280×720**: two screenshots; panel and canvas fully inside the visible TV viewport.
- TV Odd Spot at **1920×1080** and **1280×720**: two screenshots showing numbered icon cells.
- **10 of 10** mocked scenarios had no horizontal document overflow and no captured JavaScript console/page exceptions. Loaded bundled-font checks returned true. This is **not exhaustive coverage** of every lobby, Showdown, mini-game or device state; other touch targets and sunlight/dark-room legibility still need visual and physical testing.

### Not run / cannot be claimed

- **`npm install` was attempted but FAILED:** registry DNS/network resolution error (`EAI_AGAIN` contacting `registry.npmjs.org`). The dependency tree could not be installed in this environment; **Express, Socket.IO and qrcode were unavailable here**.
- **Live end-to-end browser integration was NOT run.** Cannot confirm opening a real server at `/tv/`, joining four actual `/play/` browsers through Socket.IO, pressing READY, launching a real match or automatically playing five turns. The included mocked browser check does **not** substitute for this test.
- **Real-phone and home-network tests NOT run.** Live QR scanning, a busy-port fallback on Windows, TV/phone synchronisation, actual 3-second penalties, and all 16 interactive mini-games require manual device testing.
- **`docker build`, live Render, and live Oracle deployment NOT run.** Docker was unavailable. The Dockerfile/static-server inspection indicates `source-art/` is not copied/served, but this was not validated by a deployed image.
- **Accessibility/usability** in strong sunlight and in a dark room, screen-reader behaviour, and all tap targets across all states have NOT been exhaustively tested.
- **Fib Factory facts NOT fact-checked against external live sources.** The 60 unchanged entries are listed in `docs/FIB-FACTS-REVIEW.md` with confidence ratings and source suggestions, not verified citations.

### Packaging and assets

- The 36 original PNGs have been moved to `source-art/avatars/` outside Express's `public/` static root; only runtime WebP thumbnails remain under `public/avatars/thumbs/`.
- The **complete ZIP intentionally retains the PNG source art**, so moving them improves web/Docker asset exposure but **does not make the downloadable source ZIP much smaller**. The original ZIP was **54,909,202 bytes (52.37 MiB)**; the assembled release ZIP is approximately **60.86 million bytes (58.04 MiB)**, an increase of approximately **5.68 MiB**. New preview screenshots and retained full-resolution source art explain why the complete source ZIP is larger, even though the public/Docker runtime tree is smaller.
- Bundled locally: Cabin Bold and Lato Regular WOFF2 plus SIL Open Font Licence texts. Runtime browser CSS references local files only.

To test the unverified end-to-end behaviour on Windows, follow `docs/WINDOWS-TEST-CHECKLIST.md` and record any problems before calling this version production-ready.
