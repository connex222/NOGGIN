# NOGGIN Flagship Improvement — baseline and acceptance record

**Date:** 11 November 2026
**Source:** `main` at `82c91fbcbeb56936495d4a1b0281e2d3a933f9aa`
**Original development branch:** `improvement/noggin-flagship`; owner authorised PR #10 for release on 11 November 2026
**Release status:** Owner-authorised release despite incomplete CI and physical-device acceptance. See [canonical flagship release record](NOGGIN-FLAGSHIP-RELEASE.md).

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

**Historical pre-authorisation gate:** P0 was not completed before the owner authorised merge and deployment on 11 November 2026. The outstanding tests remain post-deploy obligations; see [release record](NOGGIN-FLAGSHIP-RELEASE.md).

## Continuation — adaptive verdict pacing (11 November 2026)

- `server/board.js`: normal-speed low-impact result holds changed from a flat 2,900 ms to 1,300 ms (no score change), 2,000 ms (minor score change), or the original 2,900 ms (large score movement, round-game winner or Last Orders). The corresponding relaxed holds are 2,600 / 3,400 / 4,200 ms. TV move presentation time is still added before verdict timing; server-authoritative scoring and timers are preserved.
- The default Everyone Rolls mode generally groups player landings, so the saving applies **per result**, not automatically once for every contestant. Potential savings: 1.6 seconds for an empty verdict and 0.9 seconds for a small verdict versus the old normal setting, subject to full-game measurement.
- `public/tv/sound.js` and `public/tv/tv.js`: incoming final-winner announcement now explicitly interrupts previous host narration and releases soundtrack ducking before the winner line.
- `tests/flagship-verdict-pacing.test.js`: deterministic checks added for score-neutral, small, big, Last Orders, relaxed and movement-presentation results.
- `docs/editorial/FLAGSHIP-DUPLICATE-REVIEW.md`: four within-bank repeated-prompt groups and four cross-game factual repeats documented for editorial owner review. Questions and answers are untouched.
- CI remains unsuccessful: the latest runs fail in ~2 seconds without any recorded job steps or accessible logs; the untouched baseline exhibited the same pattern. Treat CI as an infrastructure/runner investigation **not a verified passing test**. Manual/local Node checks remain required.

**Follow-up limitation:** No physical devices or full-game timing benchmark has been run. This remains a development branch, not a certified release.

## Follow-up reliability work — 11 November 2026
**Confirmed source defect:** `server/board.js` shifted gameplay clocks on reconnection but did not shift `presentUntil`, `explainer.until` or `standings.until`. That could shorten or prematurely expire animation, explanations, or the Last Orders ranking following host downtime. These three timestamps are now shifted together with all gameplay deadlines by `resumeClocks`.

**Checkpoint defect:** `server/state-store.js` shifted deadlines but omitted the same display timing fields. Checkpoint restoration now shifts these timestamps before pausing the recovered room. `tests/flagship-reconnect-timing.test.js` asserts both paths and idempotent second resume.

**Multiplayer checks added:** `tests/flagship-multiplayer-resume.test.js` covers unique seats and start with 2, 4 and 8 phones, rejection of late NEW joins, host reconnect without resetting seat order, and a phone rejoining an in-progress game using its original token. These are **automated regression test source**, not claimed physical-device pass results.

**Live baseline:** The documented Render `/health` and `/tv/` endpoints could not be reached from the available external retrieval environment. Deployment health is unverified. The free Render blueprint has no persistent `NOGGIN_STATE_FILE` configuration, so a server **process restart** may lose room state even though same-process browser refresh/reconnect is supported. Do not claim durable crash recovery.

**CI:** The GitHub Actions runs complete as failures in a few seconds with no recorded job steps or runner name, including the pre-change `main` baseline. Neither a pass nor a specific underlying cause has been established.

**Release state remains BLOCKED:** Tests must run on a machine with Node and dependencies available. Physical device acceptance and the full game-length benchmark must follow before merging or deploying.

## Simulator instrumentation and Windows handoff (11 November 2026)

- `tools/simulate.js` now emits `verdictCount` (quiet/minor/headline), `resultHoldsPerGame` and `estimatedResultTimeSavedSecondsPerGame`. The last value is a **counterfactual calculation**, comparing the new timings with the old flat 2,900 ms normal-mode result hold. It is not a stopwatch measurement or evidence of a real session being shorter. No random-number selection, scoring rule, difficulty threshold, asset, or voice line was changed.
- `RUN-FLAGSHIP-QA.bat` is a development-only, one-click Windows test runner. In a Git checkout of this branch it verifies the branch, installs dependencies, runs syntax checks, Node tests, two 100-match model simulations and the repository release audit. Every stage and its failure code are recorded in `NOGGIN-FLAGSHIP-QA-RESULTS.txt`. It does not push, merge, or deploy.
- A direct automated run in this assistant environment was not possible: the private repository can be inspected and edited via the connected GitHub account but is not available to the local Node toolchain. The GitHub Actions job itself still fails before any steps appear, so **local QA results remain a release requirement**.
- Do not report simulation predictions as physical multiplayer acceptance. A real TV and multiple phones are still needed to check focus, latency, reconnection, audio start, pacing and winner flow.

## Final branch-hardening pass — 11 November 2026
- Added `tests/flagship-round-flow.test.js`: absent-player automatic dice, final-round standings duration, and host-interrupted Everyone Rolls clock recovery. The tests guard behaviour without changing any gameplay rules.
- Reviewed CI workflow `.github/workflows/ci.yml`: it uses `ubuntu-latest`, checkout, Node 22, npm, Python guide generation and release audit. GitHub's failure job contains **zero recorded steps and a blank runner name**, despite a completed failure conclusion and the same behaviour on unmodified `main`. This is evidence that the failure occurs before checkout/test execution, but it is **not sufficient to name billing, entitlement, capacity, or settings as the root cause**. Inspect the Actions run's visible annotations or administrator billing/settings before changing workflows.
- Keep this change set in **draft review** until tests execute, simulator results are read, and physical TV/phone acceptance passes. No merge/deployment authority is implied by opening a draft PR.
