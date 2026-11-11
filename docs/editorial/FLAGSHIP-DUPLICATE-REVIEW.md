# NOGGIN Flagship — editorial duplicate candidate register
**11 November 2026 · read-only content audit**

This report contains **review candidates only**. No data JSON, approved answer, score, or game rule was changed. Text-normalisation ignores case, punctuation and repeated whitespace; it does **not** prove that answers are wrong or that items are semantically duplicated.

## Exact/normalised prompt repeats requiring owner review

| Bank | Item IDs | Prompt | Stored answer | Action |
|---|---|---|---|---|
| Fib Facts | `fb-018`, `p6final-fib-found-018` | The chemical symbol for gold is ___ | Au / Au | Review duplicate |
| Fib Facts | `fb-020`, `p6final-fib-found-017` | The chemical symbol for oxygen is ___ | O / O | Review duplicate |
| Fib Facts | `p6b2-fib-004`, `p6final-fib-found-004` | A right angle measures ___ degrees | 90 / 90 | Review duplicate; different editorial statuses |
| Majority Rules | `mj-009`, `mj-p6-017` | Best board-game piece? | Audience-choice answers | Review duplicate |

## Repeated factual prompts across different games

| Buzzer Battle | Close Call | Shared prompt |
|---|---|---|
| `v3-buz-070` | `v35-cc-028` | How many hearts does an octopus have? |
| `v3-buz-086` | `v35-cc-023` | How many bones are in the adult human body? |
| `v3-buz-139` | `v35-cc-057` | How many sides does a 50p coin have? |
| `alpha250-buz-073` | `v35-cc-047` | How many points is a try worth in rugby union? |

The cross-mode answers agree in these four cases. However, the Buzzer entries are marked `review-pending` and the Close Call equivalents `needs-owner-check`. The status must be respected; this inspection does not certify their sources.

## Coverage
Files inspected: `bid-categories` (76), `buzzer-questions` (738), `caption-scenes` (122), `close-call` (335), `fib-facts` (346), `higher-lower` (542), `majority-questions` (200), `mind-categories` (180), `noise-clues` (280), `sketch-words` (530), `unscramble` (375).

One exact-content cross-bank overlap (e.g. TEAPOT between Sketch and Unscramble) can be intentional because gameplay differs. This report excludes those word overlaps from the editorial blocking queue.

**Not performed:** independent checking of every source, semantic similarity detection, gameplay frequency sampling, or replacement of flagged questions. Source approval remains with the editorial owner.
