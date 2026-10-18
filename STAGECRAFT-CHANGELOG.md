# NOGGIN v0.9 Stagecraft — what actually changed

## Gameplay
- **Headline Bet:** before rolling, a player with at least one Spark may switch on a +2/-1 wager. Winning the contested landing gives +2 bonus Sparks; not winning loses 1 extra Spark (on top of normal last-place penalties; floor zero). Passive squares never trigger a wager. Bet resets each turn.
- **Earn Director Cues:** each contest winner regains one Director Cue, up to two; passing Start still replenishes one. Cues may be spent for a +/-1 step Director's Cut.
- **Shorter decision waits:** Director's Cut selection 8.5 to 6 seconds. Automatic timeouts for the catch-up die, wildcard, swap, and Showdown rival selection reduced from 20 to 12 seconds. Choices have automatic fallbacks.
- **Count Flash, Surprise Target:** remember a mixture of three icon types. Which icon must be counted is revealed only when the flash ends. The target count stays server-only until the answer reveal.
- **Memory Lane, Reverse Finale:** the fourth round requires tapping the shown sequence backwards, with visible instructions.

## Presentation
- Larger original winning/losing contestant portraits on a dedicated TV verdict overlay.
- 24 original character-specific verdict lines to reinforce the Noggin Panel's personality.
- Headline wager button on the phone, clear risk/reward labels, visible in-turn state.
- Updated single-page rules PDF.

## Compatibility
- Retains the 36-space stage, 12 contestants, 16 mini-games, all Showdowns, Windows launcher, Render and Oracle/Docker deployment files.
- Single instance architecture unchanged; cross-server room sharing remains unsupported.

## Verification limitations
- Automated rules tests and mock-browser screen renders are not equivalent to human playtests.
- npm packages could not be downloaded here (registry DNS EAI_AGAIN), so live Socket.IO and target-cloud deployments are **not verified**.
- The simulator uses modelled skill, 75 seconds per turn and does not model player uptake of Headline Bets. Timing/comeback numbers are indicative only.
- Fib Factory fact-checking and real 4–8-player entertainment testing remain outstanding.
