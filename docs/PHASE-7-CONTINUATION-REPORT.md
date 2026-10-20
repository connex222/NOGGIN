# Phase 7 continuation — stroke delivery (20 October 2026)

## Implemented
- `server/gateway.js`: accepted Sketch & Sabotage strokes are validated through the existing server-authoritative `rooms.drawGame()` path and sent as a compact `game:stroke` event **only** to the host TV bound to the room. The sender still receives an acknowledgement with its personalised state. No full `room:state` broadcast is sent on each stroke.
- `public/tv/board-view.js`: append a validated stroke to the existing canvas without rebuilding the stage. Reject mismatched rounds and duplicate/out-of-order indexes. Ordinary authoritative snapshots still contain all strokes for reconnection and future screen rebuilds.
- `public/tv/tv.js`: route the new stroke event only for the active room.
- `tests/gateway.test.js`: update the existing sketch privacy test for compact delivery, and add a focused event-delivery regression test.

## Limits
- Real TV/phone network tests, multi-device reconnect tests and visual readability checks were not run in this environment.
- Further formatting and migration of the remaining static HTML/CSS tests are not complete.
- This candidate still includes historical root Markdown files; the documentation consolidation described earlier needs an independent review. No documents were deleted in this pass.
- Editorial fact flags and audio licensing evidence are still outstanding.
