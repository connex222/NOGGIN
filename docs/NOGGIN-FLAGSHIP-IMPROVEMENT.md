# NOGGIN Flagship Improvement — baseline and acceptance record

**Date:** 11 November 2026
**Source:** `main` at `82c91fbcbeb56936495d4a1b0281e2d3a933f9aa`
**Development only:** `improvement/noggin-flagship`
**Release status:** NOT ACCEPTED. No merge or deployment permitted without owner approval.

## Inspected baseline
- Server-authoritative 2–8 player rooms, Socket.IO TV/phone, 28-space board, game modes Classic and Showtime, Everyone Rolls and Sequential, special spaces, Showdowns, tie resolution, and HEADSTART tutorial.
- `public/tv/index.html` starts at the lobby. `welcomeScreen` is `hidden`; `showcase.css` explicitly preserves hiding. The legacy `cinematic-v4.js` contains a 15-second Games Night sequence but is not included in the active TV HTML. Do not restore it.
- The lobby includes `lobbyHeadstart` inside Game Settings, and tutorial.js attaches its click handler. Screen alignment cannot be visually certified from source alone.
- Existing host audio and HEADSTART narration were **independent playback paths**: opening the tutorial did not stop an in-progress host recording or backing music. This is a code-confirmed overlap risk.
- Ordinary scoring victories were triggering the same confetti as major payoffs and the finale: excessive visual noise, reducing emphasis on the winner.
- Server round-roll window 12 s; game pick 8 s; Last Orders standings 4 s; special-space explainers 3 s; server presentation includes 1.3 s die animation plus movement and settle. TV die animation is 1.24 s. These timings are coordinated; changing only one risks desynchronisation.
- Approved rules including Rotate Showdown, +1 Spark and Showtime catch-up were not altered.
- Content banks and approved art, avatar identity mappings, recorded Northern host files and 19 narrated tutorial MP3s were left untouched.
- A basic exact prompt duplicate scan found none among 738 buzzer, 335 close-call, 346 fib-facts, 200 majority, and 280 noise-clue entries. This does **not** cover semantic duplicates, other banks or answer truth.
- The existing `docs/editorial/RELEASE-REVIEW-QUEUE.csv` still contains pending review entries; do not interpret an automated schema check as final editorial approval.

## Changes on this branch
1. `public/tv/sound.js`: add exclusive tutorial audio mode; stop recorded host speech and music upon opening HEADSTART; suppress host lines during the tutorial; restore the latest requested music when closing.
2. `public/tv/tv.js`: expose the TV's audio coordinator to HEADSTART; reserve routine confetti for gains of at least three Sparks, and preserve full final winner effects.
3. `public/tv/tutorial.js`: acquire/release the audio stage on tutorial open/close.
4. `tests/flagship-pacing-audio.test.js`: static entrypoint checks and a mocked-audio regression for the exclusive tutorial stage.

## Verification and limitations
- Code and structural review completed on GitHub.
- GitHub Actions `NOGGIN tests` reports **failure on both the untouched baseline and the development branch**. Job log retrieval returned 404. Do not claim passing CI, and do not infer a code regression solely from this signal. Investigate runner availability and obtain a complete `npm run check && npm test && npm run audit` transcript.
- Deployed Render URL documented in main: `https://noggin-0u32.onrender.com/tv/`. An external fetch could not access it during this audit, so **deployed behaviour was not verified**.
- No browser screenshots, physical phones, network interruption measurements or attended match recordings were obtained.
- Quantified end-to-end timing and measured balance adjustments remain **not done**; no scoring parameters were changed without simulations.

## Physical-device acceptance checklist — all pending
- [ ] TV 720p and 1080p: open /tv/ directly to lobby, no Games Night/NOGGIN splash, avatar/logo separation, readable room code and QR.
- [ ] How to Play opens from within Game Settings, back/exit restores focus, no dual voice/music, sound toggles work.
- [ ] Join 2, 4, 6 and 8 separate physical phones across Android and iOS where available; distinct avatars, seat order, Ready/Start, settings controls and phone readability.
- [ ] Everyone Rolls and Sequential; Classic and Showtime; regular and relaxed speed; reduced-motion and colour-safe settings.
- [ ] Rotate Showdown, underdog/catch-up dice, Spark deltas and tie-breaks agree with approved rules.
- [ ] Test late reconnect (not new mid-game entry), host refresh, phone refresh, Wi-Fi dropout, phone offline timeout, Skip Offline, host pause/resume.
- [ ] Finish complete games without manual state edits; verify ranking, ties, winner audio, report export, new room.
- [ ] Time each stage for 2-, 4-, and 8-player games: join-to-start, roll-to-first-question, answer-to-reveal, score-to-next-input, full game length. Compare before and after using same scripted session.

## Remaining release blockers
P0: prove complete real-device session and recovery; obtain passing CI logs; verify live baseline visually without deploying this branch.
P1: profile all modes' elapsed time and idle time; adjust jointly coordinated TV/server presentation with measured tests; review question ambiguity, semantic overlaps and references using the existing editorial queue.
P2: verify every audio clip and narrator path on actual TV browser.

**Do not merge or deploy this branch until all P0 checks pass and the owner approves.**
