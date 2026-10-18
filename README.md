# NOGGIN v2 — redesigned TV welcome and lobby

The two-stage TV experience has a new balanced lobby. The top of both screens shows all twelve characters, with randomized expressions on opening. The second screen has three clearly separated panels (room code, **live** QR joining, and settings), an eight-seat roster, and a Start button that only becomes active when all players are ready. Audio controls are placed away from game controls. On smaller displays the panels stack vertically.

**Windows:** Unzip to a new folder and double-click `start-noggin.bat`. Follow the exact TV address in its black console. **Render:** Deploy the contents of this folder at the GitHub repository root on the `main` branch. The server automatically supplies the correct QR code and URL for each room. Do not hardcode LAN links into the hosted build.

See `NOGGIN-V2-CHANGES.md` for release details.

---

# NOGGIN v1.4 — Game-Show Showcase

**NEW:** Two interactive TV screens based on the approved designs. Both feature the twelve original avatars in one of three randomly selected expressions on each opening. The first screen offers Start Game, Join With Phones, How To Play and a live phone QR. The second screen shows the actual live room code, a working QR code, player roster, game settings and Start The Show control. **Never use the room code shown in mockup screenshots.**

The 16 mini-games, board, multiplayer logic, Windows launcher, Render/Oracle deployment settings and bundled soundtracks are retained. See `SHOWCASE-UPDATE.md` for details.

## IMPORTANT: v1.2 TV and phone redirect fix (18 October 2026)

Earlier v1.2 bundles accidentally redirected `/tv/` back to itself, causing Chrome's
`ERR_TOO_MANY_REDIRECTS` even when `/health` reported healthy. That also affected
`/play/`. Both have been corrected in this build. See `REDIRECT-FIX.md`.

# Windows launch fix (18 October 2026)

This build handles port 3000 already being used on Windows by selecting the next available local port. Read `STARTUP-FIX.md` before launching.

# NOGGIN v1.2 — Rehearsal Edition

**What is new:** a host-only downloadable match-performance report, stricter room/session access, and repeatable four-/eight-player gateway rehearsals. Mini-game selection now respects the injected random source for consistent tests. See `REHEARSAL-GUIDE.md` for first-time Windows, Render and Oracle setup.

**Status:** 129 automated tests and 104 static checks passed locally; actual Socket.IO connectivity has **not** been verified here because `npm install` cannot reach the npm registry. This is not production certification.

# NOGGIN v1.1 — Showrunner Edition

**A complete updated game (not a patch).** Built on Playtest v1.0, retaining 12 contestants, 36 expression images, 16 category mini-games, four Showdowns, the 36-space stage board and the Windows/Render/Oracle deployment setup.

## New in v1.1

- **Host PAUSE / RESUME:** During a game, the TV shows a PAUSE button at the bottom of the board. Tap it to freeze the game safely (including server deadlines and the visual cues in Quick Draw, Count Flash, Memory Lane and Unscramble). RESUME picks up where everyone left off. Phones display **GAME PAUSED** and temporarily disable their inputs.
- **Skip a disconnected active player:** When the current player's phone is offline, the TV shows a **SKIP OFFLINE** button. After an explicit confirmation the host can advance their turn without waiting for the full reconnect grace period. Skipping cancels the current contest and any Headline Bet **without penalties or false winners**. If the phone reconnects within the usual 30 seconds and no skip occurred, the turn resumes.
- **Host recovery fix:** A QR generation failure during host reconnection no longer steals the original host session or locks the TV out of its own room. Once QR generation succeeds, the replacement is atomic.
- **Checkpoint timing fix:** On single-instance Windows/Oracle checkpoints, restoring a paused game also moves mini-game animation timestamps; the host's intentional pause is preserved after restart.
- **New regression coverage:** Timer alignment, manual pause, reconnection grace, offline skip, permissions, host QR rollback, restored pauses and 4 viewport mock-browser scenarios.

**These are resilience and hosting improvements, not new mini-games.** The fun factor still requires a real living-room test.

## Install (Windows)

1. Extract this ZIP and open `NOGGIN-Showrunner-v1.1`.
2. Double-click `start-noggin.bat` (Node.js 20+ required; first launch downloads dependencies).
3. On the computer open `http://localhost:3000/tv/`.
4. Join 2–8 phones by scanning the code. The PC can use Ethernet while phones are on Wi-Fi **provided they share the same router/network**.
5. Start the show. During play, the bottom right TV panel has **PAUSE** and, when necessary, **SKIP OFFLINE**.
6. For a real multiplayer acceptance test, pause during Count Flash or Quick Draw, resume, disconnect an active phone and reconnect it before 30 seconds, then try **SKIP OFFLINE** in a separate round.

For public hosting, the existing `render.yaml`, Docker and `deploy/oracle/` configurations are included. Render and Oracle remain **separate independent room services**, not a synced cluster. Set `NOGGIN_PUBLIC_URL` if QR links need a fixed public HTTPS origin.

See `SHOWRUNNER-GUIDE.md`, `PLAYTEST-CHECKLIST.md`, `INSTALL.md` and `TEST-RESULTS.md` for details.

**Status:** Playtest build. Offline and simulated-browser tests passed, but this environment could not install npm dependencies, so **actual Socket.IO delivery, Android/iPhone testing and Render/Oracle deployment are not verified**. The 60 Fib Factory facts still require editorial review.

---

# NOGGIN v1.0 — Playtest Edition

**Complete updated game**, based on v0.9 Stagecraft: 12 playable contestants, 36 avatar expressions, 16 games, four Showdowns, the perspective board, TV + phone clients, Windows, Render and Oracle deployment configurations.

## What's new in v1.0

- **Spotlight Picks:** during each corner Showdown's 4.5-second opening (7.5 seconds in Relaxed mode), all *spectators* can predict a winner. A correct prediction earns **1 Director Cue**, capped at 2; no Sparks are awarded, no stake is taken, and the prediction cannot be changed. If the duel is drawn, nobody earns a Cue. Predictions close at the start of the duel, preventing late winner-chasing.
- **Phone stability:** broadcast updates from other players no longer delete a focused answer field or live sketch pad. Actual round changes still update the controls. The fix covers Caption This, Fib Factory, Unscramble, Bid to Win, tug sums, and other timed forms. New strokes from peers appear on the retained drawing canvas when no local stroke is active.
- **Room startup reliability:** if a server QR cannot be created, the incomplete room is deleted instead of being left as a ghost room.
- **More tests:** four new offline tests of prediction permissions, rewards, draws and QR failure; four targeted phone interaction regression scenarios at two screen sizes.

## Quick Windows setup

1. Extract the ZIP. Open the `NOGGIN-Playtest-v1.0` folder.
2. Double-click `start-noggin.bat`; first launch must download packages from npm (requires internet access).
3. On the host computer open `http://localhost:3000/tv/` and leave the server window running.
4. Join with 2–8 phones using the TV QR code. For local use, devices should be on the same router (Ethernet on PC plus Wi-Fi on phones is fine).
5. Choose avatars, press **Ready** and **Start the Show** on the TV.

For public hosting, use `render.yaml` (Render) or `deploy/oracle/README.md` (Oracle + Caddy HTTPS). **Deployments are independent; rooms do not transfer between them.** Use Windows first for a local acceptance test, then one public host.

Read `PLAYTEST-CHECKLIST.md` for a practical acceptance script, `HOW-TO-PLAY.pdf` for printable rules and `TEST-RESULTS.md` for verified and unverified items.

**Release status:** preview build, not a commercial-certified release. Network-dependent tests could not be run here because npm DNS lookups failed. Automated gameplay tests and mocked-browser UI tests do not substitute for a real TV-and-phones session.

---

## Historical notes for v0.7–0.9

# NOGGIN Stagecraft v0.9

**Latest build:** Complete game inherited from Director’s Cut v0.8, updated with renewable Director Cues, Headline Bets, Surprise Target Count Flash, Reverse Finale Memory Lane and larger personality-driven results.

Read `STAGECRAFT-CHANGELOG.md` for exact modifications, `INSTALL.md` for Windows/Render/Oracle instructions, `HOW-TO-PLAY.pdf` for the rules, and `TEST-RESULTS.md` for verification and limitations.

**Important:** No completed real-device multiplayer match has yet been confirmed. This remains a public-preview build, not a production-certified game.

# NOGGIN — Use Your Head

## v0.8.0 — Director’s Cut (strategic and mini-game upgrade)

**This is a complete replacement package** for Windows, Render and Oracle, with all Phase 1–6 and v0.7 functionality retained.

### Your biggest new decision: Director’s Cut

On your turn you can roll immediately as before, **or tap PLAN A LANDING** first. After rolling, the phone displays your normal landing (free) and any legal landings one space shorter or longer. Choosing the nudge spends one of your **two Director Cues**. You regain one Cue whenever you complete a lap, up to a maximum of two. If you hesitate, the server automatically chooses your original roll after 8.5 seconds. The decision is optional; normal rolling still takes one tap.

The TV highlights the available destinations and shows each player’s Sparks, Cue balance and progress towards the target. Board decisions remain server-authoritative and are tested for invalid choices, double use, timeout and catch-up dice.

### Mini-game and pacing improvements

- **Count Flash** now displays 36 mixed symbols. Count only 8–18 target objects while ignoring distractors; the correct count stays secret from phones until the reveal. This tests rapid visual discrimination rather than estimating a huge group of identical icons.
- **Higher or Lower** now uses two strikes before elimination. A single incorrect answer does not force someone to watch the rest of the game doing nothing.
- Normal game introductions are shorter (Speed/Brain 3.3 s, Create/Together 3.5 s, Showdowns 3.5 s). Relaxed timing remains available. Intermediate Speed/Brain reveals show the correct answer for 1.2 s; between turns the result screen lasts 2.9 s.
- TV studio styling, animated landing rings, target-progress meters and phone choice buttons have been updated. Memory Lane TV pads now play distinct synthesised tones (when TV audio is enabled). Reduced-motion accessibility is retained.

**Remaining constraints:** the balancing simulator is model-based and assumes 75 seconds per turn; it cannot establish actual human round timing or whether players enjoy this strategy. 2-player sessions remain shorter than the original 30–45-minute standard target. Public hosting, real phone connections, outside moderation and 60 Fib Factory facts still need verification.

## v0.7.0 — Quality upgrade (previous changes)

NOGGIN is a 2–8 player, TV-hosted British party game. The TV displays a 36-space perspective board; each player uses a phone to join, roll, answer, draw and compete. The server owns dice rolls, timings, scores, game answers and room state. **First to 12 Sparks wins** in Standard mode (8 Quick / 16 Long).

**This is a complete updated project, not a patch.** It includes all previously built phases, the complete 12-character/36-expression avatar set, 16 mini-games, four corner Showdowns, numeric Noggin-Off, sound, installation files and server code.

## What changed in v0.7

- **Speed/Brain answer reveals:** each intermediate round now displays the actual answer (where applicable), the round winners and a 1.8-second pause. Answer keys remain server-only until reveal.
- **Showdown audience cheers:** players not selected for a corner Showdown can back one of the two challengers; a crowd meter appears on the TV. Spotlight Picks are anonymous to other players, reward a capped Cue when correct, and **never award Sparks or change the winner**.
- **Two-player fairness:** the random picker excludes Caption This and Majority Rules in 2-player rooms. Both always produce tied results at two players under their current voting rules. They remain available for 3–8 players and are preserved as engine tests.
- **Bomb Squad:** clues now require cooperation and simple deduction; 5–8-player rooms distribute at least one scrap to every participant.
- **Family-room language check:** obvious adult language is blocked in submitted captions, fibs, guesses and player names when the Family setting is enabled. **This is a limited whole-word filter, not guaranteed moderation**. Speech, drawings, invented spellings and evasion cannot be fully moderated automatically.
- **Remote performance:** all 36 character expressions use tiny bundled WebP assets during play, while original 1024-pixel transparent PNG sources remain in `/public/avatars`.
- **Test coverage:** updated release audit, new regression tests, and mock browser tests for the spectator and answer-reveal states.

**Not yet solved:** strategy still relies on two limited Cues per lap; the trivia bank needs human editorial review, live multiplayer and hosted deployment remain untested here, and longer-term enjoyment cannot be established through automated tests. This build is not yet a 9.5/10 game by evidence.

## One-minute Windows setup

1. Extract the ZIP. Open the `NOGGIN-Directors-Cut` folder, not the ZIP preview.
2. Double-click `start-noggin.bat`. On the first run it needs internet access to install Node dependencies.
3. In the computer's browser open `http://localhost:3000/tv/`.
4. On a phone connected to the same router, scan the QR on the TV. Join with at least two phones and press **Ready**.
5. Start the show on the TV. Leave the black server window open.

**If QR joining fails**: on Windows run `ipconfig` and use the computer's Ethernet/Wi-Fi IPv4 address, for example `http://192.168.1.20:3000/play/`. Allow Node on the **Private** network Windows firewall and avoid isolated guest Wi-Fi.

For Render and Oracle deployment, see **INSTALL.md** and **deploy/oracle/README.md**. For printable rules, see **HOW-TO-PLAY.pdf**. The PDF is regenerated from the game's code catalogs using `python tools/make-how-to-play.py` (requires Python + ReportLab).

## Mini-games and Showdowns

| Speed | Brain | Create | Together |
|---|---|---|---|
| Quick Draw | Higher or Lower | Sketch & Sabotage | Mind Meld |
| Count Flash | Memory Lane | Noise Annoys | Majority Rules |
| Odd Spot | Close Call | Caption This | Relay Sums |
| Colour Clash | Unscramble | Fib Factory | Bomb Squad |

The four board corners feature **Buzzer Battle**, **Tug of Wits**, **Bid to Win** and **Nerve**. Landing on a corner lets you challenge another player for up to two of their Sparks. Equal winners at the Spark target face a closest-number **Noggin-Off** tiebreak.

### Phase 6 balancing change

- A last-place player already gets to roll two dice and pick one.
- **Underdog boost:** with 4–7 players, a winner who began the turn at least three Sparks behind the leader gets one additional Spark. With **8 players**, that bonus is two Sparks.
- Only actual mini-game or Showdown winners receive it. Passing Start, landing on a special space and draws do not grant it. The game records start-of-turn Spark totals to make that decision consistently.

This is a provisional balancing rule; the 1,000-game-per-group synthetic simulator estimates better comeback chances, but real players must validate whether it feels fair.

## Hosting choices

- **Windows**: LAN-friendly launcher; optional JSON checkpoint stored in `state/rooms.json` in the extracted directory. Do not post this file publicly because it contains session tokens.
- **Render**: `render.yaml` web-service blueprint. Free instances can sleep after inactivity, restart, and lose their in-memory games; no persistent disk is included. An active WebSocket with messages may prevent idle sleep, but do not treat it as uptime insurance.
- **Oracle Cloud**: `Dockerfile` and `docker-compose.yml` use one Node backend behind a Caddy HTTPS reverse proxy, Docker data volume for checkpoints, and a real DNS name. Oracle may be out of free VM capacity or reclaim idle free instances.
- **Both**: run separate room sets. A code on Render does **not** connect to a room on Oracle. To share rooms you would need a distributed state store, locks and Socket.IO coordination—not just mirrored deployment.

## Commands

```sh
npm install
npm test                   # offline game logic + fake gateway integration
npm run check              # JavaScript syntax
npm run audit              # static release assets and data validation
npm run simulate           # 1,000 synthetic matches at each group size
npm start                  # Node web server; requires installed dependencies
python tools/make-how-to-play.py  # regenerate PDF after rule changes
```

The game requires Node.js 20 or later (22 recommended). Local `npm install` and live Express/Socket.IO were **not executable in this build environment** because DNS access to the npm registry failed. These operations must be checked on your deployment machines. The offline tests are not a real network end-to-end test.

## Project layout

```text
server/              Rooms, scoring, gateway, minigames and optional checkpoints
public/tv/           TV studio screen and effects
public/play/         Phone controller and game input interfaces
public/shared/       Shared theme, board data and avatar catalogue
public/avatars/      36 full PNGs and 36 small WebP thumbnails
public/sounds/       Local sound manifest and synthesized audio fallbacks
data/                All starter question, word and prompt banks
tests/               Node test suite
/tools/              Simulator, guide generator, browser tests, release audit
deploy/oracle/       Caddy TLS and Oracle VM instructions
.github/workflows/   Node syntax, test and audit CI recipe
```

## Release status

This is a **public-preview candidate**, not an independently certified production release. See `TEST-RESULTS.md` for recorded results, and `RELEASE-CHECKLIST.md` for real-device, security and editorial work still required. Sixty Fib Factory facts are flagged `review-pending` and should be checked before commercial launch. Family Mode currently has no alternate adult-tagged question bank, so toggling it does not change the bundled selections. It also cannot filter what players themselves write or say.
