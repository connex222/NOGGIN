# NOGGIN v2 — Show Arena Board Integration

The TV play screen uses the **user-selected neon game-show board illustration** as a backdrop (`public/tv/art/board-stage.webp`).

- All **36 server-authoritative spaces** are rendered on a separate SVG racetrack. The reference image's printed spaces are covered by a live navy/gold track rather than used as gameplay data.
- Scores, contestant portraits, turn, Sparks target, die choice, showdown options, pause/report controls and route highlights continue to read from the multiplayer game state.
- The room QR code remains on the unchanged opening and lobby screens.
- The phone game interfaces remain the complete v2 designs from the previous build.
- TV host inputs still operate as before. Rolling is on the player's **phone**, so the central roll call is a status cue rather than a nonfunctional TV button.

Design adapts at 1280×720, 1920×1080 and narrower screens. The original game board geometry is not changed server-side. See `tests/arena-board.test.js` for regression checks.

Source illustration (pixel-identical, lossless WebP): `source-art/board-reference-selected.webp`. Browser-optimized stage image: `public/tv/art/board-stage.webp`. The complete v2 downloadable ZIP retains the original PNG source as well.
