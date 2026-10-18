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
