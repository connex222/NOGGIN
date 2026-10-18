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
