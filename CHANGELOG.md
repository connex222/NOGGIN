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
