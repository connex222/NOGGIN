# NOGGIN — factual certification status (17 November 2026)

**Status: NOT FULLY CERTIFIED.** This report must not be represented as a full external fact check.

## Current scope
Inspected all 11 live JSON data banks on the repository default branch: bid-categories 70, buzzer-questions 730, caption-scenes 122, close-call 335, fib-facts 339, higher-lower 542, majority-questions 199, mind-categories 180, noise-clues 280, sketch-words 530, unscramble 375. **Total: 3,702 records.** Several banks contain subjective or creative prompts, not objective factual assertions.

## Checks performed this session
- Parsed each JSON bank and checked all 3,702 records for missing IDs, duplicated IDs, missing core prompts, and identical normalised prompt text within its own mode.
- Checked 730 buzzer records for four choices, valid zero-based answer indexes and non-repeating choices. The single heuristic candidate `buzz-097` was a **false positive**: the Unicode minus sign in “−10” was dropped by the normalisation heuristic, making it look identical to “10”. The actual options are distinct and the correct answer is 0 °C.
- Checked 335 Close Call records for numeric answers and 542 Higher/Lower facts for numeric values, all 339 Fib blanks for nonempty answer and blank markers, and 70 Bid categories for nonempty answer lists.
- Independently recalculated all 100 simple arithmetic Buzzer prompts of the form “What is a ± b?”; all 100 indexed answers matched. Arithmetic correctness does **not** certify non-arithmetic facts.
- **No confirmed structural errors** resulted from these checks.

## External fact-check coverage
The previous question-specific register `506-QUESTION-FACT-CHECK.csv` documents 90 source checks and **416 still requiring source/answer-completeness checks**. Earlier work separately recorded six source checks and removed 18 risky entries. This session did not review all remaining factual assertions against independent authoritative sources.

## Release decision
Do not set all records to `Passed`, `verified`, or `source-checked`. Do not infer factual accuracy from a schema pass, arithmetic check, or a URL in a source note. Each unverified factual question needs an evidence URL and checked alternative-answer scope. Bid categories need fairness adjudication because their matcher accepts only predefined entries. Subjective/creative prompts need editorial-quality evaluation, not a true/false fact certification.

No question-bank answers, rules, images, audio, avatars or game controls were changed in this session.
