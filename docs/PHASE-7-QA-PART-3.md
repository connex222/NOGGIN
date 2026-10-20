# Phase 7 QA — Part 3: Editorial clarity

## Scope
Focused follow-up to the 194-entry editorial backlog in Phase 6. Edited seven Fib Factory entries and three Bid to Win entries to specify the conditions/scope of the expected answers. No game rules, scoring, content-bank counts or features were changed.

## Fixes
- `fb-001`: distinguish a chessboard's 64 small squares from all possible square groupings.
- `fb-004`: specify each team's starting association-football players, goalkeeper included.
- `fb-033`, `fb-034`: specify approximately one atmosphere for water freezing/boiling answers.
- `fb-044`: specify honey bee rather than all bees.
- `fb-054`: specify New York Harbour rather than the ambiguous 'New York'.
- `fb-059`: specify a Monday–Friday working week rather than implying universal work patterns.
- `p6b2-bid-003`: distinguish low E from high E on a six-string standard-tuned guitar.
- `p6b2-bid-010`: specify individual-medley swimming strokes.
- `p6final-bid-026`: qualify that recycling acceptance varies by local authority.

`docs/editorial/REVIEW-CHECKLIST.csv` now shows the revised wording and answers for these 10 entries, while leaving editorial decisions pending. A wording correction is NOT external fact verification. The release audit still reports 194 unresolved review flags: 23 Buzzer, 99 Fib, and 72 Bid. This list may undercount unflagged errors and near-duplicates.

## Verification
- `npm test`: 240 passed, 1 skipped, 0 failed.
- `npm run check`: passed.
- `npm run audit`: 104 checks passed; 194 editorial flags remain.
- `node tools/simulate.js 100`: 100 matches completed for each of 2, 4, 6 and 8 players.
- `node tools/simulate.js 100 --everyone`: 100 matches completed for each of 2, 4, 6 and 8 players.
- Added `tests/editorial-clarity.test.js`: three regression tests.

## Still required before production sign-off
External review of all 194 flagged entries, a separate scan for unflagged factual errors and semantically repetitive prompts, outstanding Phase 4 five-round/readability exceptions, actual phone/TV multiplayer playtesting, and sound-asset licence verification. No claim of three independent factual sources is made for the edits in this batch.
