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
