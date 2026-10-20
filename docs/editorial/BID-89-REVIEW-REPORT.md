# Bid to Win — Review of 89 Flagged Entries (20 October 2026)

All 89 flagged entries were enumerated in `BID-89-FULL-ASSESSMENT.csv`. The previous review status has **not** been cleared merely because an entry was read. The 89 entries mostly describe *open-ended categories* but game logic stores only a shortlist of examples. Even when every stored example is correct, a valid alternative can be rejected. This is a gameplay fairness defect, not merely an editorial checkbox.

## Improvements made

- Added a server-side matcher for common spelling and UK/US vocabulary variants (e.g., sun cream/sunscreen, wellies/Wellington boots, pitta/pita, plasters/adhesive bandages, torch/flashlight).
- Prevented players counting the same stored answer twice by submitting two different accepted names for it.
- Corrected or narrowed eight ambiguous or potentially misleading category prompts, including the 3,000-metre steeplechase as an Olympic track event (instead of implying a flat 3,000-metre race is a standard Olympic track event).
- Added four new server-matcher regression tests and an 89-entry category assessment CSV.
- Rebuilt the editorial review queue, retaining all 89 pending statuses.

## Outstanding limitation

The matcher only knows examples and explicit aliases. It cannot objectively decide whether an unlisted answer to an open-ended category (e.g., a type of pasta) is correct. An exhaustive automatic accepted-answer set is impossible for many categories. A server-controlled challenge/adjudication mechanism, or replacing such categories with finite, unambiguous categories, is still required for fair final sign-off. No claimed source verification of the 89 categories was performed in this pass.

## Verification

`npm test`: 256 passed, 1 skipped. `npm run check`: passed. `npm run audit`: passed, 89 editorial reviews pending. `node tools/simulate.js 300`: completed 1,200 sequential matches. Real phones, TVs, and hosted multiplayer were not tested.
