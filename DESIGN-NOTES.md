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
