# NOGGIN v1.3.0 — Release candidate (18 October 2026)

- **A — Reliability:** Fixed eight Speed/Brain mini-game timing paths (ms not seconds); QR links now use the port actually serving the Windows host request. Phase 4 and Phase 5 timer units reviewed; new regression tests.
- **B — Displays:** Compact TV header, 75% board/23% right-hand scoreboard, contained 6×6 phone grid, responsive TV drawing panel; responsive layouts and avatar seating.
- **C — Rules:** Odd Spot numbered phone control with TV-only icons; thumbnail avatar board tokens; new default Classic rules and opt-in Showtime with server-enforced restrictions; finer board labels/closed track gap.
- **D — Packaging:** Full PNG art moved outside public to source-art/avatars (retained in the source ZIP, therefore source download size does not substantially shrink); original assets no longer served or copied into Docker; merged project notes, moved historical test logs, bundled locally licensed fonts, reviewed 60 Fib facts, updated README and test evidence.
- Current health check: `version: 1.3.0`, `phase: release-candidate`. See TEST-RESULTS.md for actual verification.

---

## Consolidated historical update notes (newest first)

### BROWSER-FIX.md

**Follow-up correction:** The earlier advice to use the correct port was necessary but
not sufficient: a server redirect-loop bug also affected `/tv/` and `/play/`.
The corrected `server/index.js` is included. See `REDIRECT-FIX.md`.

# NOGGIN v1.2 — Browser / Blank Screen Fix

This update keeps the game and the Windows/Render/Oracle architecture unchanged.

## The likely cause

When another app already occupies port 3000, the Windows launcher correctly selects a new port, such as 3001. Using the old `localhost:3000` address opens the wrong service; entering only `localhost` uses port 80 and does not open NOGGIN.

## What is fixed

- On Windows, the launcher now opens the correct TV address in your default browser after the server starts.
- The black window still prints the exact URL.
- You can double-click `open-noggin.bat` to reopen the last recorded TV URL while the server is running.
- `/check/` is a diagnostic page that checks the server and seven required web resources, independently of the TV interface.
- The TV displays an error message if a required script cannot load, if a script throws, or if the multiplayer server has not connected after 12 seconds.
- Hosting on Render/Oracle remains unchanged: no automatic browser opening or port scanning on public hosting.

## Windows instructions

1. Extract the full ZIP to a **new** folder. Do not merge with an older game version.
2. Double-click `start-noggin.bat`.
3. Wait for **NOGGIN SERVER IS RUNNING**. It should open the TV page automatically.
4. If the browser did not open, copy the exact **OPEN THIS TV ADDRESS** URL from the black window, including its port and `/tv/`.
5. If that page does not load, change `/tv/` to `/check/` on the same port. For example `http://localhost:3001/check/`.
6. If the diagnostic page reports a failure, provide its results and the black server-window text.

**Do not open** `http://localhost` without a port, and do not assume NOGGIN always uses port 3000.

## Verification limits

These changes have Linux-side JavaScript syntax tests and static-browser diagnostics. Opening Windows' default browser and real Socket.IO connections still require testing on the user's actual Windows computer.

## Automated checks performed

- 135 Node.js tests passed (131 existing tests plus 4 targeted browser-startup tests).
- 104 static release-audit checks passed.
- JavaScript syntax checks passed.
- Live Windows browser opening and real Socket.IO sessions are **not** verified here. A local browser smoke check was blocked by this environment's browser network policy.


### STARTUP-FIX.md

# NOGGIN v1.2 Windows Startup Fix

This package fixes the `EADDRINUSE 0.0.0.0:3000` crash caused by another program already listening on port 3000.

## Simple Windows steps

1. Close the old NOGGIN error window.
2. Extract this complete ZIP to a NEW folder (don't mix it with an older extracted game).
3. Double-click `start-noggin.bat`.
4. Look for `NOGGIN SERVER IS RUNNING`. The black window will display the **actual** TV URL. It might use port 3000, 3001, 3002, etc.
5. Open exactly that URL on your PC. Example: `http://localhost:3001/tv/`.
6. Join from a phone using the freshly displayed QR code or phone address. Do not use an old saved URL or QR code.

The launcher attempts the next available port from the configured port through ten higher ports. It does not terminate any other Windows process and does not change the required port when hosted on Render or Oracle.

## If there is still an error

Open Command Prompt and run:

    netstat -ano | findstr :3000

If you see `LISTENING`, another program owns port 3000. Find its PID (last column), then run `tasklist /FI "PID eq 12345"`, replacing 12345 with the actual PID. Only stop the process if you recognise it.

Use `http://localhost:3000/health` to see if an older NOGGIN server already responds on port 3000.

This is a startup bug fix only. Live Socket.IO sessions still need real-device testing.


### REDIRECT-FIX.md

# NOGGIN v1.2 — TV/Phone Redirect Loop Fix

## Root cause

In Express 4, a string route registered as `app.get('/tv', ...)` also
matched `/tv/` because strict routing was off. Since the redirect target
was `/tv/`, Chrome hit an infinite loop (`ERR_TOO_MANY_REDIRECTS`).
The same bug affected `/play/`. The `/health` route was unaffected.

## Fix

`server/index.js` now uses anchored regular-expression redirects for the
no-trailing-slash forms only. Both `/tv/` and `/play/` are served by
`express.static`, which returns their respective `index.html` files.

No changes to scoring, game state, stored rooms, portraits, hosting or
network settings. A regression test checks redirect registration and an
additional live HTTP smoke test runs when npm dependencies are installed.

## Windows installation (full ZIP)

1. Close the black NOGGIN server window (Ctrl+C).
2. Extract this ZIP into a separate folder.
3. Open `NOGGIN-Rehearsal-v1.2` within it.
4. Double-click `start-noggin.bat`.
5. Wait for `NOGGIN SERVER IS RUNNING` and read the exact port printed.
6. Visit `http://127.0.0.1:PORT/tv/` replacing PORT with the printed number.
7. Phone controllers use `http://YOUR-PC-LAN-IP:PORT/play/`.

## Windows installation (hotfix ZIP)

In your existing extracted NOGGIN game folder, replace
`server/index.js` with the corrected file from the hotfix, preserving
the `server` directory. Then restart `start-noggin.bat`.

## Quick temporary workaround if you're still on the old version

Use `/tv/index.html` rather than `/tv/`, and `/play/index.html` rather
than `/play/`. These URLs bypass the buggy redirects.


### WINDOWS-AUDIT-FIX.md

# NOGGIN v1.2 — Windows audit correction

## What was wrong
`tools/release-audit.js` converted a thumbnail path into an archival PNG path by replacing `/thumbs/` in an OS filesystem path. That replacement worked on Linux but not on Windows, where path separators are `\`. The audit therefore looked for `.png` files in `public\avatars\thumbs`, although the original PNG files are in `public\avatars`.

## What changed
The audit now obtains the original PNG filename from each avatar's URL using `path.posix.basename()`, then constructs the local pathname using `path.join()`. It works on both Windows and Linux. There are three new regression tests: a Windows-style path case, an archival PNG completeness check, and running the release audit.

No game mechanics, scores, network settings, controls, or assets have been changed. This build is based on **NOGGIN v1.2 Browser Fix**, so it retains the `/check/` diagnostic page and automatic port fallback launcher.

## How to install on Windows
1. Close any previous NOGGIN command windows.
2. Extract the complete ZIP to a new folder.
3. Open `NOGGIN-Rehearsal-v1.2` inside the extracted folder.
4. Double-click `verify-noggin.bat` and check for `ALL LOCAL AUTOMATED CHECKS PASSED`.
5. Double-click `start-noggin.bat` to start the server and use the exact address it prints.

The release audit does not test whether Windows can reach a live game server. If the browser still cannot connect, run `curl.exe -i http://127.0.0.1:PORT/health` in another Command Prompt, replacing PORT with the actual listening port.

## Known pending work
The Fib Factory content still contains 60 items marked for editorial review. Live Windows phone/TV multiplayer and cloud deployments have not been verified by these static tests.


### AUDIO-UPGRADE.md

# NOGGIN audio upgrade — 18 October 2026

Added 20 actual short MP3 sound effects and three original synthesized full ambient loops in OGG format. Replaced the former repeating sine-wave arpeggios with background tracks and improved electronic sound effects. Separate on-screen TV controls manage FX volume, Music volume and music on/off. All tracks are stored locally and require no third-party API or CDN.

This is a self-produced electronic soundtrack, not a purchased library of Foley recordings or live instruments. Professional recorded Foley and a commissioned musician remain potential further upgrades.

The previous redirect-loop fixes, Windows audit fix, Windows launcher and game logic are kept unchanged.


### STAGECRAFT-CHANGELOG.md

# NOGGIN v0.9 Stagecraft — what actually changed

## Gameplay
- **Headline Bet:** before rolling, a player with at least one Spark may switch on a +2/-1 wager. Winning the contested landing gives +2 bonus Sparks; not winning loses 1 extra Spark (on top of normal last-place penalties; floor zero). Passive squares never trigger a wager. Bet resets each turn.
- **Earn Director Cues:** each contest winner regains one Director Cue, up to two; passing Start still replenishes one. Cues may be spent for a +/-1 step Director's Cut.
- **Shorter decision waits:** Director's Cut selection 8.5 to 6 seconds. Automatic timeouts for the catch-up die, wildcard, swap, and Showdown rival selection reduced from 20 to 12 seconds. Choices have automatic fallbacks.
- **Count Flash, Surprise Target:** remember a mixture of three icon types. Which icon must be counted is revealed only when the flash ends. The target count stays server-only until the answer reveal.
- **Memory Lane, Reverse Finale:** the fourth round requires tapping the shown sequence backwards, with visible instructions.

## Presentation
- Larger original winning/losing contestant portraits on a dedicated TV verdict overlay.
- 24 original character-specific verdict lines to reinforce the Noggin Panel's personality.
- Headline wager button on the phone, clear risk/reward labels, visible in-turn state.
- Updated single-page rules PDF.

## Compatibility
- Retains the 36-space stage, 12 contestants, 16 mini-games, all Showdowns, Windows launcher, Render and Oracle/Docker deployment files.
- Single instance architecture unchanged; cross-server room sharing remains unsupported.

## Verification limitations
- Automated rules tests and mock-browser screen renders are not equivalent to human playtests.
- npm packages could not be downloaded here (registry DNS EAI_AGAIN), so live Socket.IO and target-cloud deployments are **not verified**.
- The simulator uses modelled skill, 75 seconds per turn and does not model player uptake of Headline Bets. Timing/comeback numbers are indicative only.
- Fib Factory fact-checking and real 4–8-player entertainment testing remain outstanding.


### SHOWRUNNER-CHANGELOG.md

# NOGGIN v1.1 — Showrunner changelog

Compared with v1.0.0-playtest:

- Add authenticated socket events `game:pause`, `game:resume`, `game:skip-offline`.
- Expose TV host recovery buttons only during an active game, and the skip button only for an offline active player.
- Freeze and later shift server deadlines, early visual cues (readyAt / flashEndsAt / revealAt), showdown hard stops and mini-game phase timestamps. TV Memory Lane pad flashes and notes now use server times rather than render-relative timers; paused flashes stop immediately and peer state updates cannot restart them.
- Preserve the 30-second reconnect grace across intentional manual pauses.
- Cancel incomplete mini-game/showdown/challenge and any Headline Bet on a disconnected-player skip.
- Fix transactional host session recovery when QR creation fails.
- Restore manual pause intent and visual-timer timestamps in single-instance checkpoints.
- Add ten offline regression tests and mocked Chromium host controls/paused-state scenarios at four screen sizes.

No new art, mini-games or game board tiles were added in this release. Room persistence remains single-instance; Render and Oracle are independent.


---

## Earlier CHANGELOG.md

# v1.2.0 — Rehearsal Edition

- Added **↓ MATCH REPORT** on the TV, with locally generated anonymous timing/round statistics (JSON).
- Added 5 automated simulated-gateway tests including four-phone full-round recovery, eight-player joins, role protection, restored telemetry, and deterministic mini-game selection.
- Unauthenticated room lookup no longer returns in-progress game states.
- A connected player socket cannot silently rebind itself into a TV host session.
- Consistently passes an injected RNG through dice, movement, landing and timeout-selected mini-games.
- Checkpoint restoration excludes server downtime from active gameplay timing metrics.
- Added `REHEARSAL-GUIDE.md` with practical live multiplayer acceptance steps.

# NOGGIN v1.1 Showrunner Edition

See `SHOWRUNNER-CHANGELOG.md` for the new release changes.

---

# v1.0 Playtest Edition

- Spectators can make time-locked Spotlight Picks during Showdown introductions; a correct prediction awards one Director Cue (cap 2), not Sparks.
- Preserve focused phone forms and active drawing canvas during incidental room broadcasts; correctly rebuild when a round/key changes.
- Apply remote confirmed strokes incrementally to preserved canvases.
- Roll back room creation if QR encoding fails.
- Extend automated and mocked-browser acceptance checks.

# NOGGIN Change Log

## v2.0.0 — Phone UI redesign (from user-supplied v1.3.0)

- Matched phone presentation to the NOGGIN TV welcome/lobby using its bundled gold-logo artwork, stage lighting, blue panels and gold trim.
- Created a single responsive phone design system for joining, avatar picking, ready-up, turn controls, all 16 mini-games, four Showdowns and results.
- Restyled native interactive controls and timers without changing any game/Socket.IO server rules or QR join behavior.
- Preserved existing reconnect/session keys.
- Added tests and mock-browser screenshots. Real Windows/Render multiplayer still requires hands-on verification.



## v0.8.0 — Director’s Cut, sharper games and improved show presentation

- Added opt-in tactical roll planning with 2 Director Cues, ±1-space landing changes, free standard choices, 8.5-second auto-selection, and lap-based Cue replenishment.
- Preserved last-place two-dice catch-up option inside the planning flow. Added new validation to prevent non-active players, invalid options, overspending and repeated choices.
- Improved Count Flash with a fixed grid of mixed target/distractor objects (8–18 targets among 36), reducing the role of pure estimation.
- Improved Higher or Lower to allow two strikes before elimination, avoiding early dead-time.
- Reduced normal introduction/reveal/result delays, kept relaxed timing, and added TV landing-ring cues, leaderboard progress bars and a clearer phone choice view.
- Added distinct TV pad tones for Memory Lane when sound is enabled.
- Added 8 new regression tests and mock browser checks at all four requested viewport sizes.
- No new sound/video/image downloads or runtime internet dependencies; existing Windows, Render and Oracle deployments remain supported as separate instances.



## v0.7.0-quality-upgrade — Fairness, feedback and spectator participation

- Fixed two-player automatic-draw category selection: Caption This and Majority Rules remain implemented but are not picked automatically in 2-player games.
- Added answer/winner reveal for intermediate Speed and Brain mini-game rounds, including server-only answer privacy until reveal.
- Added non-scoring, one-vote-per-person Showdown cheers for studio audience members and a live TV audience meter.
- Redesigned Bomb Squad clue fragments to require simple shared deduction and ensured every player in 5–8 player games receives a clue.
- Added limited family-friendly whole-word filtering for text submissions and player names; not full moderation.
- Served existing 256px WebP avatars at runtime, retaining all 36 original 1024px PNGs.
- Updated tests, PDF rules, asset audits and responsive mocked browser checks.
- Still pending: full live multiplayer, Windows/Render/Oracle deployment checks, real playtesting, editorial review, originality and pacing work.


## v0.6.0-phase6 — Release preparation

- Updated Windows, Render and Oracle deployment instructions and release checklist.
- Added a source-driven one-page printable PDF, plus `tools/export-guide-data.js` and `tools/make-how-to-play.py`.
- Added **Underdog boost**: with 4–7 players, +1 bonus Spark for game/Showdown winners who began the turn 3+ behind leader; with 8 players, +2 bonus Sparks. Existing two-dice last-place catch-up rule remains unchanged.
- Balanced simulation estimates improved, but 2-player and 4-player standard matches may still be shorter than the intended 30–45 minutes under the current assumptions.
- Separated room lookup, join and creation limits to support eight phones behind a single NAT gateway while restricting anonymous creation.
- Added new automated tests for underdog award, same-IP joining and TV/6-phone gateway outcome (fake transport), plus CI and static release audit.
- `/health` now reports Phase 6 and version. Windows launcher respects an optional `PORT` setting.
- All 36 avatars and existing 16 category games / four Showdowns preserved.

## Known limits

- No real third-party npm install, live Socket.IO, Render/Oracle, six-phone or end-to-end real-network test was possible in the build environment.
- No automatic synchronized failover between hosts; Render and Oracle rooms are separate.
- 60 Fib Factory records require human verification; user-generated content is not moderated automatically.
- No definitive 30–45-minute human gameplay proof, security audit, or accessibility certification.
