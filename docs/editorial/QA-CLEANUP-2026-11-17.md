# NOGGIN question QA — 17 November 2026

Reviewed all 11 question/prompt JSON banks (3,724 entries at baseline). Removed 4 exact/punctuation-normalised duplicates from their own game modes; other game modes have different mechanics and must NOT be deduplicated by word/category alone.

- `p6final-fib-found-004` data/fib-facts.json: A right angle measures ___ degrees. (answer 90)
- `p6final-fib-found-017` data/fib-facts.json: The chemical symbol for oxygen is ___. (answer O)
- `p6final-fib-found-018` data/fib-facts.json: The chemical symbol for gold is ___. (answer Au)
- `mj-p6-017` data/majority-questions.json: Best board-game piece? (answer undefined)

Structural QA: 100 standard arithmetic buzzer questions have correct numeric answer positions; no missing or malformed buzzer answer index; no identical drawing/unscramble words repeated in the same mode. No placeholder markers detected. Source and fact-level verification still outstanding for items already marked `review-pending` (530 before this clean-up). An obscure-but-valid item is not automatically an error. Do not mark remaining review-pending as Passed.

Cross-mode shared facts remain by design: e.g. octopus hearts in Buzzer Battle and Close Call have different mechanics. Broader semantic duplicates may still exist.

## Final 11-bank structural QA result

All 3,720 retained entries passed required-field and per-bank duplicate checks. Numeric higher/lower entries contain finite values; Close Call answers are numeric; Fib Facts have blanks and answers; Buzzer Battle option indices are valid and its 100 standard arithmetic prompts have correct numeric keys. Unscramble and Sketch use distinct word entries within each mode. 530 review-pending flags remain and must not be silently approved. This verifies only the machine-checkable properties; it is not a line-by-line independent source verification.
