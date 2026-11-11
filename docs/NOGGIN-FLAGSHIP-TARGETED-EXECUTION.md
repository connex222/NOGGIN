# NOGGIN Flagship — targeted source execution evidence

Date: 11 November 2026
Branch: `improvement/noggin-flagship`
Scope: **restricted JavaScript V8 harness**, not full Node/npm or real browser acceptance.

## What was actually executed

Read the latest source files from the connected private GitHub repository. Compiled these 11 JavaScript files in a V8 function context (syntax PASS for all): `public/tv/sound.js`, `public/tv/tutorial.js`, `public/tv/tv.js`, `server/board.js`, `server/state-store.js`, `tools/simulate.js`, and the five `tests/flagship-*.test.js` source files.

Executed the real `board.js`, `layout.js`, `rooms.js` and `sound.js` functions in an isolated V8 harness. The harness replaced external Node dependencies, random UUID/byte generation, the content filter and unfinished mini-game modules with local deterministic stubs. Therefore it tests the *selected source functions*, not the entire running application.

| Source-level scenario | Observed result |
|---|---|
| Empty-result hold | 1,300 ms — PASS |
| +1 Spark result hold | 2,000 ms — PASS |
| +3 Spark result hold | 2,900 ms — PASS |
| Relaxed empty hold | 2,600 ms — PASS |
| Relaxed +1 hold | 3,400 ms — PASS |
| Last Orders +1 Spark doubles to +2 and holds 2,900 ms | PASS |
| Result waits an additional 1,800 ms for unfinished presentation | PASS |
| Room start with 2, 4, and 8 unique seats | PASS in stubbed harness |
| TV disconnect/reconnect shifts shared roll deadline by 5,500 ms | PASS in stubbed harness |
| Phone reconnect retains original player ID and seat | PASS with distinct simulated credentials |
| 4-player Everyone Rolls automatically fills three absent dice | PASS in stubbed harness |
| Last Orders standings extends shared roll clock by 4,000 ms | PASS in stubbed harness |
| Interrupted host rolls preserve clock and progress to movement | PASS in stubbed harness |
| HEADSTART interrupts host line, releases audio ducking, suppresses overlapping narration and resumes correct soundtrack | PASS with mock Audio objects |

**Mock caveat:** A preliminary phone-resume probe produced a false negative because an unrealistic mock generated the **same session token for every player**. The probe was rerun with distinct fake tokens and passed. This was a harness issue, not a confirmed production bug. The latest findings above use distinct tokens.

## What has NOT been verified

- GitHub Actions / `npm test` / `npm run check` / `npm run audit` / `node tools/simulate.js` have not been executed successfully. GitHub's current runners terminate the node-tests job with no recorded steps; the failure also appears on pre-change `main`.
- Complete real Socket.IO gateway traffic, browser rendering, keyboard/focus and mobile layout, multi-round game finish, asset playback or timing on actual phones.
- Live Render behaviour or restart durability.

**Release verdict: BLOCKED.** This is partial source-function execution evidence, NOT a substitute for full automated tests or physical acceptance.
