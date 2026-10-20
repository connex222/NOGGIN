# NOGGIN v0.8 — Why these changes were made

## Signature decision: Director’s Cut

The original board forced a landing after a random die roll. Having plenty of spaces but almost no route control is not meaningful strategy. Director’s Cut creates an optional moment of choice: keep the original roll for free, or trade a scarce Cue to move one space shorter/longer. It is the player — not the RNG — choosing whether a Showdown, Wildcard, or another event is worth using a Cue. Cues replenish slowly at Start to encourage timing decisions.

**Guardrails:** there are only two Cues; no player can buy Sparks with them; you cannot nudge to zero or seven steps; expiry defaults to the free result; last-place two-dice catch-up is not removed. The server checks all choices and deductions. Routing does not reveal secret question answers.

## Mini-game focus

- Count Flash previously used 15–60 identical objects with heavy overlaps and a two-second display. That skewed toward rough guesses. It now uses a fixed 12×3 pattern of 36 icons with 8–18 clearly defined targets, mixed with a contrasting distractor. Phones are asked for target counts, not total counts.
- Higher or Lower used to eliminate a player on one mistake and make them watch the rest. Two strikes now creates recovery opportunities within the challenge.
- Memory Lane TV flash pads produce notes through the existing TV sound engine.

## Pacing

The previous 5-second intros, 1.8-second interim reveals and 4.5-second post-turn delay accumulated over a whole match. Standard timing is now 3.3–3.5 s intros, 1.2 s interim Speed/Brain reveals and 2.9 s post-turn pause. Director’s Cut adds at most an 8.5-second voluntary decision, and non-planners roll as before. Relaxed timing remains more forgiving.

## TV and phone presentation

A studio floor, a clear leader highlight, target-progress meters, Cue balance, selected-destination rings, and bold phone route cards are meant to direct attention to the *decision* rather than visual ornament. Other existing avatar art, sound fallbacks and reduced-motion settings are retained.

## Not solved by these changes

The 16 mini-games still need external player playtests and some content banks need editorial review. Strategic depth is deliberately lightweight — this is a party game, not a simulation. Distributed room persistence across Render and Oracle remains unsupported. NOGGIN may benefit from further art direction and game-show commentary after live evaluation, but additional features should not be added blindly.


---

## Archived document: PHONE-V2-DESIGN.md

# NOGGIN v2 — Phone Interface Design & Testing

**Source of truth:** your supplied `NOGGIN-v1.3.0(1).zip`; this release is a forward redesign of that project, **not** a rebuild from older v1.2 files.

## What changed

- **Official game-show logo:** bundled WebP artwork extracted from the existing welcome-stage image and shown on phones.
- **Brand system:** deep navy, electric blue, violet accents, amber marquee borders and illuminated call-to-action buttons.
- **Common player card:** avatar, player name, room code, Spark total, Director Cues.
- **Round panel:** category/status badge, dynamic mini-game title, server-supplied instructions, live countdown and proportional timer bar.
- **Join/READY:** same stage styling on room-code entry, 12-avatar selection and player readiness.
- **All 16 mini-games:** original 1.3.0 game input controls remain in place, but their HTML controls share the v2 visual system.
- **Showdowns and board:** buzzer, rope, bidding, nerve, numerical Noggin-Off, dice/route/target/category decision actions share the same components.
- **Dense/specialist controls:** Odd Spot preserves all 36 numbered squares (NOT the conceptual four-duck picture); Memory Lane retains six playable pads; sketch retains a touch-action-free drawable canvas; written/numeric answers remain native forms.
- **Accessibility:** visible focus states, tactile-size targets where layout allows, reduced-motion media query, scrollable long inputs and no fixed-height phone viewport traps.

## Source changes

- `public/play/index.html` — new structural markup with existing IDs intact.
- `public/play/play.js` — presentation-only state classes and timed progress.
- `public/play/studio.css` — complete game-show design layer over original gameplay CSS.
- `public/play/art/noggin-logo.webp` — local logo artwork using the game's existing welcome image.
- `tests/phone-v2.test.js` — regression checks.
- `tools/phone-v2-browser-smoke.py` — mocked browser test across sizes.
- `docs/previews/phone-v2/` — screenshots and measured browser results.

## Verification

`npm test`, `npm run check` and `npm run audit` are executed for this package before release.
The browser smoke tests exercise 16 mini-games, seven showdown/duel states and six board/result states at 360×640, 390×844 and 430×932. The smoke setup uses a **mock Socket.IO connection**, not live players. A successful mock test does not establish that every mini-game works on actual phones or that music/audio/haptics work on every device.

## Still to verify with actual devices

1. Scan the TV QR into at least two different phones; join, change avatar and ready up.
2. Play a full match and verify phone buttons submit once, the TV advances, and disabled controls react to lost connection.
3. Test the canvas using a finger, number keyboard submissions, Memory Lane pads and the full 36-square Odd Spot round.
4. Test phone browser scaling and legibility with Android and iPhone; test an on-screen keyboard while the game timer runs.
5. Test 2/4/8-player devices over your actual Render / Windows network.

**The playing-board TV graphic remains the updated original from 1.3.0.** This release focuses on the phone UIs; the separate TV board art concept is not yet incorporated as a working SVG board.



---

## Archived document: PLAYTEST-CHECKLIST.md

# v1.2 PLAYTEST

- [ ] Export the TV **MATCH REPORT** after each full game; attach the JSON to bug reports.
- [ ] Check report pause time is separate from active game time.
- [ ] Check reconnect within 30 seconds keeps the same character and score.

# NOGGIN v1.0 — Four-player acceptance checklist

Use one Windows PC connected to a TV and four phones (ideally a mix of iPhone and Android). Record the elapsed time and any failures.

- [ ] Extract the new ZIP in its own folder, run `start-noggin.bat`, load `http://localhost:3000/health` and verify version `1.0.0-playtest`.
- [ ] Open `/tv/`, scan the QR from phones on the same local network and check that all four join.
- [ ] Attempt to pick a character already taken; it must be unavailable.
- [ ] Mark all phones Ready, start a game, take three full turns and note any unexpected pause or duplicate input.
- [ ] During a caption or fib entry, keep typing while another phone sends an answer. Your keyboard and text must stay put.
- [ ] During Sketch & Sabotage, draw a long continuous line while other phones send guesses or strokes. Your line must not disappear or break.
- [ ] During a corner Showdown, the two spectators should see a Spotlight Pick during the opening countdown. One should pick the eventual winner; the other should pick the loser.
- [ ] After the Showdown, only the correct spectator gains one Director Cue (max two). Nobody gets extra Sparks just for predicting. A late attempt must be rejected.
- [ ] Lock one phone, reconnect within 30 seconds, and confirm the same seat is restored.
- [ ] Disable Wi-Fi for the active player briefly, then restore it. Verify no double scoring or unintended turn skip.
- [ ] Check sound, mute, reduced motion and 360px phone screen readability.
- [ ] Finish a complete match and record elapsed minutes, funniest/slowest game, and whether players want another round.

**For Render/Oracle:** repeat joining on HTTPS from a separate mobile network. Check that restarting the server does not expose any private data. Render and Oracle do not share rooms. Never publish saved checkpoint files: they include session tokens.

Report: device/browser models, network type, number of players, problems and 3 favourite/least favourite games. These are the high-value inputs for the next balance iteration.


## v1.1 interruption/recovery acceptance (new)

- [ ] In a timed Speed mini-game, TV host PAUSE freezes timer and phone inputs; RESUME restores remaining seconds.
- [ ] Reconnecting a phone within 30 seconds keeps their avatar, Sparks and active turn.
- [ ] An offline active player can be skipped after host confirmation, with no unfair Headline Bet loss.
- [ ] An online player cannot be skipped; the PAUSE/RESUME events are inaccessible from phone sessions.
- [ ] Windows checkpoint restart retains an intentionally paused game; the TV requires explicit RESUME.
- [ ] Test on Render and Oracle **separately** if both are deployed; cross-provider room syncing is not supported.



---

## Archived document: REHEARSAL-GUIDE.md

# NOGGIN v1.2 — Real Multiplayer Rehearsal (Windows, Render, Oracle)

This guide is for a non-technical host. The game has passed unit and simulated-gateway tests, **not** a complete real network match in this development environment.

## A. Start with Windows (two phones, one TV)

1. Unzip the entire `NOGGIN-Rehearsal-v1.2` folder on your Windows computer.
2. Double-click `start-noggin.bat`; allow Windows Firewall access on **Private networks** if requested. Keep the black window open.
3. On your PC, open `http://localhost:3000/tv/` in Chrome or Edge. You should see the studio and a four-character room code.
4. Make sure both phones are on the same home network as the PC. Wired Ethernet for the PC and Wi-Fi for phones is fine **if the router connects both to the same local network**. Avoid guest Wi-Fi or mobile data.
5. Scan the QR with phone 1 and phone 2, select **different** characters, enter names, then tap **READY**.
6. Start on the TV. Confirm: phone 1 can roll, TV shows an animated move, mini-game opens, both phones get the right controls, results appear, and phone 2 receives the next turn.
7. Test **PAUSE** on the TV during a countdown; confirm the phone countdown stops, then resume.
8. Test reconnection: lock the active phone for 5 seconds, unlock it and confirm the same seat returns. Separately, close that phone's browser for 30+ seconds and verify the host can use **SKIP OFFLINE**.
9. Click **↓ MATCH REPORT** on the TV and save the downloaded JSON after the match. This file contains only timing and round-count metrics, not names, answers or tokens.

If the QR doesn't work, enter on the phone `http://<COMPUTER-ETHERNET-IP>:3000/play/` with the address shown by `ipconfig` on Windows (do not use `localhost` on the phone). Verify both devices use the same router and the Windows firewall permits Node.js on the Private network.

## B. Public hosted games — Render

1. Push this full source folder to a private GitHub repository (do not include any `node_modules` directory, state files or `.env`).
2. Connect GitHub to Render. Its `render.yaml` defines a **single** Node web service and a `/health` check.
3. After deploy, open `https://YOUR-SERVICE.onrender.com/tv/`, then open the phone QR link. All users can be on different networks.
4. On low/no-cost plans, the service may sleep or restart, causing room loss. A saved report from one instance does **not** merge with a second instance. Do not advertise uninterrupted games until you have tested restarts.

## C. Public hosted games — Oracle Cloud

1. Follow `deploy/oracle/README.md` for a Linux VM with Docker Compose, a domain, and ports 80/443 open in both the VM firewall and Oracle security rules.
2. Set `NOGGIN_DOMAIN` in `.env`. Caddy provides HTTPS and forwards to the Node game service.
3. Open `https://YOUR_DOMAIN/tv/` and test with at least two phones on external networks.
4. The container keeps checkpoints on a Docker volume. Test recovering from a container restart and verify report timers exclude offline server time.

Render and Oracle host separate rooms. Running both is **not** cross-server failover: players and rooms are not synchronised.

## D. What to record

After each real match, save the JSON report and ask the players:

- Which two rounds were most fun, and which were boring or confusing?
- Did you understand Director Cues and Headline Bets without explanation?
- How often did you wait without an interesting decision?
- Did each mini-game run correctly on your particular phone?
- Did anyone lose progress on a Wi-Fi reconnect?

Interpret `waitingPercent` as time in board decisions, result cards and pre-roll waits, not as a direct measurement of boredom. The report gives evidence about timing, **not** an entertainment score. Aim to complete 4–6-person matches with no disconnect-related crashes before a public launch.

## E. Tests on your computer

The easiest method on Windows is to double-click `verify-noggin.bat` (does not need network access). Alternatively, open a Command Prompt in the game folder:

```bat
npm install
npm test
npm run check
npm run audit
```

You should see 129 automated tests pass on v1.2. To perform the simulated Socket.IO-gateway rehearsal without a running browser or external networking, run `node --test tests/rehearsal.test.js`.

### Limitations

The gateway test uses in-process fake sockets, **not** the actual `socket.io` transport. The browser test uses mocked connections. Neither proves live phone-to-TV connectivity. An actual full match and real Render/Oracle deployments must still be checked by a person with network access. The 60 editorial Fib Factory facts remain pending verification.



---

## Archived document: RELEASE-CHECKLIST.md

# v1.2 release blockers

- [x] In-process gateway integration covers four- and eight-player sessions.
- [x] Host-only game report excludes players’ names, answer text and reconnect credentials.
- [x] Static, unit and mocked-browser smoke tests pass.
- [ ] Start a real Node / Express / Socket.IO server after installing npm dependencies.
- [ ] Complete a full match with 4–6 physical phones and a TV.
- [ ] Verify public deployment separately on Render and Oracle.
- [ ] Editorially verify 60 Fib Factory facts.

**v1.0 must-test:** early Spotlight Picks, correct Cue reward, no late picks, keyboard persistence during another player's answer and drawing continuity.

## v0.9 acceptance gates
- [ ] Play one full 2-player match on Windows over real Socket.IO.
- [ ] Play one full 6-player match; check Headline Bets and both Cue recovery routes.
- [ ] Verify the results overlay and legibility on a physical 720p TV.
- [ ] Test Render public deployment, including sleep/reconnect behaviour.
- [ ] Test Oracle HTTPS and firewall setup.
- [ ] Independently verify the 60 Fib Factory facts.
- [ ] Conduct blind playtests; record idle time and enjoyment per mini-game.

# NOGGIN v0.8 Director’s Cut — release acceptance checklist

**Release designation: v0.8.0-directors-cut / preview candidate.** Complete code for all phases 1–6 is included, but the following **human and hosted-device tests are still required** before public marketing or claims of production readiness.

## Completed in this build

- [x] Complete game code and 36 original 1024px avatars.
- [x] 16 category mini-games, four Showdowns and numeric Noggin-Off.
- [x] Server-driven dice, scoring, reconnects and 36-space board.
- [x] Repair room creation/lookup/join rate limits for eight phones behind one public IP.
- [x] Add tested underdog Spark awards for 4+ players; test 1,000 simulated matches per group size.
- [x] Dynamic one-page How to Play PDF generated from source modules.
- [x] Windows launcher, Render blueprint, Oracle Compose/Caddy stack, GitHub Actions tests.
- [x] Unit, simulated gateway, offline browser and static release checks.

## New quality-upgrade checks

- [x] Regressions for fair two-player mini-game selection and no automatic 2-player voting ties.
- [x] Round-answer privacy before reveal and locked input during reveal.
- [x] Spectator cheering does not affect Sparks and is one vote per player.
- [x] All 2–8 Bomb Squad room sizes receive clue fragments.
- [x] All 36 WebP runtime avatars and original PNG files pass integrity checks.
- [x] Four responsive mocked viewports include the audience and reveal screens.
- [ ] Run an actual 2-player match, a 3–8 player caption game and a 6–8 player Showdown with spectator cheering.
- [ ] Confirm the cooperative Bomb Squad puzzle is understandable without help and finishes fairly within the timer.
- [ ] Run at least 20 mixed-age household playtests with actual timing, fun, fairness and clarity surveys.

## Must verify on real devices and servers

- [ ] `npm install`/`npm start` succeeds on Windows, Linux and in Render build logs.
- [ ] A TV and **six actual browsers** join and finish a full game through live Socket.IO.
- [ ] All 16 games and four Showdowns are completed once with two or more real phones.
- [ ] Wi-Fi phone joins a wired Windows host by QR code (including Windows firewall permission).
- [ ] TV reconnect, phone lock/reconnect, 30-second grace and local checkpoint recovery under interruption.
- [ ] Android Chrome and iOS Safari: keyboard, drawing, scrolling, vibration, foreground/background behaviour.
- [ ] Mute/volume and sound playback tested on actual TV, with reduced-motion on/off.
- [ ] HTTPS + WebSocket joining from outside LAN tested separately on Render and Oracle.
- [ ] Oracle Compose persistent volume restores a room after backend restart.
- [ ] Round trip on Render after idle sleep, deploy and WebSocket reconnect tested.
- [ ] Human playtesting balances actual session time and comeback chances, especially 6–8 players.
- [ ] Editorial check each of the **60 Fib Factory facts** plus other question banks before commercial distribution.
- [ ] Check accessibility with keyboard navigation, focus indicators, screen readers and colour vision deficiencies.
- [ ] Security/threat review for an internet-facing public URL; protect persistent token checkpoint backups.

## What the simulator does *not* prove

It uses synthetic players with approximate success rates and assumes 75 seconds per turn. Its headline statistics do not measure actual user interaction times, server load, mobile Wi-Fi stability, or play enjoyment. It may exaggerate the ease of comebacks.

## Deployment rule

Use **one backend process per room namespace**. Render and Oracle are separate games unless a future release adds a shared data store, authoritative distributed room ownership and Socket.IO messaging adapter. Never point both platforms at one JSON checkpoint file.

## v0.8 live acceptance checks (not yet complete)

- [ ] Two phones connect over Windows Ethernet + Wi-Fi, one phone uses Director's Cut to land on a chosen board square.
- [ ] With a last-place two-dice roll, both the free and altered choices appear and the Cue is deducted exactly once.
- [ ] Disconnect or lock a phone during the 8.5-second Director's Cut selection: the server chooses the free default without taking a Cue after timeout.
- [ ] In Count Flash, confirm all players are counting only the target symbols, and the target number stays hidden until reveal.
- [ ] In Higher or Lower, first mistake leaves a player active; second eliminates them.
- [ ] Run one complete real match at 2, 4, 6 and 8 players with timings and player feedback.
- [ ] Confirm one Render session and one Oracle/Windows session independently; do not imply shared cross-host rooms.



---

## Archived document: SHOWRUNNER-GUIDE.md

# NOGGIN Showrunner — interruption and recovery guide

## Normal pause

On the TV board, click **PAUSE**. A paused banner appears on the TV and all phones. Answers cannot be sent while paused. Press **RESUME** and the clocks restart with the remaining time intact. Pausing does not give a player extra Sparks, Cues or answers.

## A player's phone disconnects

When it is the current player's turn, the game pauses automatically for up to **30 seconds**. Reopen the same phone tab or site: the stored session should recover its original seat. If it cannot reconnect, the TV host may click **SKIP OFFLINE**, confirm the player's name and continue. If nobody intervenes, the normal 30-second rule skips the turn. Skipped Headline Bets are cancelled, not charged.

The TV cannot skip an **online** player. If the room is manually paused, press RESUME before considering a skip. This prevents accidental skipping while players have agreed to a break.

## TV host connection lost

The room pauses until the authenticated TV session returns. Reopen `/tv/` in the same browser profile (do not clear browser site data). A failed QR regeneration leaves the original host in place rather than replacing it. On recovery the game clocks continue from their prior position.

## Windows or Oracle restart with checkpoints

Use one running server and a writable private state directory. The optional `NOGGIN_STATE_FILE` points to a checkpoint file. If the game was paused deliberately before restarting, it stays paused on recovery. Reopen the original TV browser session and press RESUME once phones have rejoined. The checkpoint contains private reconnect tokens; **never upload it to a public repository or share it**.

## Render

Rooms normally live in memory and do not survive service replacement on an ephemeral free instance. PAUSE does not prevent the service from sleeping or restarting. A deployment to Oracle cannot recover a room from Render automatically. For uninterrupted paid public service, a future storage/coordination upgrade is needed.

## Ten-minute acceptance test

1. Start the TV, join two phones and play until a Quick Draw/Count Flash round occurs.
2. Pause mid-round; check that both phones show a paused state and cannot submit.
3. Resume after a break; check that the TV display and phone timers agree.
4. During the active player's turn, switch that phone to airplane mode and reconnect within 30 seconds. Check their original avatar and Sparks remain.
5. Disconnect the active phone again; use SKIP OFFLINE. Confirm only that turn is skipped and no Headline Bet penalty is charged.
6. Make sure an online player cannot be skipped and a phone cannot operate the TV host buttons.
7. Finish an entire four-player game and record any delays or games that feel repetitive.

