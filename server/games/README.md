# NOGGIN server mini-game engines

- `phase3.js` — four Speed and four Brain mini-games.
- `phase4.js` — four Create and four Together mini-games, each with private role-specific state, server-owned timers and scoring.

All client data is served via `board.publicBoard` and `rooms.state`. Do not broadcast the full `room.board.minigame` internal object; it contains secret words, solution keys, saboteur IDs, votes, and player-private clue cards. The Socket.IO gateway creates a separate state for each recipient. `game:draw` sends validated pointer strokes (not raw pixel buffers) and accepts only the artist and hidden saboteur.

The game logic uses `node:test` and does not need npm dependencies for its unit tests. Phase 5 will implement Showdowns and the final Noggin-Off; Phase 6 should split per-game modules for long-term maintainability.
