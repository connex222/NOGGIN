# NOGGIN v2 — The Dice Theatre

## What you will see

When a player taps **ROLL DICE** on their phone, the TV displays a large, six-faced dice animation in the NOGGIN gold/blue lightbox. The die tumbles for around 1.2 seconds, lands on the **actual number supplied by the server**, and announces the result. The player’s token then moves across the numbered game-board spaces with the existing hop sound. The result panel automatically clears.

The two-dice catch-up rule in Showtime also has its own animation. Both dice display their real values and stay visible until the player chooses on their phone. Director's Cut landings work the same way. No game rules or scoring algorithms were changed. The die outcome is never generated in the browser.

Sound (after clicking **Enable sound** on the TV):

- `sfx-dice-roll.mp3` — initial tumbling / rattling effect.
- `sfx-dice-land.mp3` — intended new landing clack; for now the existing `sfx-reel-stop.mp3` plays as its substitute. To add your own recording, put it in `public/sounds/` and add its filename to `public/sounds/sound-manifest.json`'s `files` array.
- The existing board hop sound still plays as the token travels.

## Accessibility and performance

- NOGGIN's **Reduce motion** control or the browser/OS reduced-motion preference stops tumbling and immediately reveals the correct value.
- No external libraries, images or CDNs are needed for the 3D dice. Each face and pip is made from HTML and CSS.
- A repeated Socket.IO state update does not replay a completed roll.
- The server resolves every roll instantly as before; the animation controls only what the TV audience sees. If a challenge begins very quickly, the dice presentation can overlap its opening moment.

## Validation

- 178 Node tests passed; 1 live HTTP test skipped, 0 failures.
- 104 release audit checks passed, 0 errors.
- Playwright mock browser checks covered 1280x720, 1366x768, 1920x1080, one-die animation/reveal, two-dice catch-up roll, repeated Socket.IO messages and reduced-motion mode. No script errors or viewport overflow in those checks.
- Real Windows/Render multiplayer audio/video synchronisation still needs human testing.

## Files changed

- `public/tv/index.html` (dice overlay)
- `public/tv/arena-board.css` (3D dice and lighting)
- `public/tv/board-view.js` (dice presentation and move sequencing)
- `public/tv/tv.js` (roll and landing audio triggers)
- `public/tv/sound.js`, `public/sounds/README.md` (future audio placeholder)
- `tests/dice-animation.test.js`, `tools/dice-animation-browser-smoke.py` (automated checks)
