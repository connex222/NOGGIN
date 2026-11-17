# NOGGIN question-by-question fact-check register — 17 November 2026

## Coverage
Every one of the **506 previously outstanding questions** has an individual row in `docs/editorial/506-QUESTION-FACT-CHECK.csv`. A row says exactly whether the factual answer was verified against a published source or remains open.

- **87** answer records matched sources and are now `source-checked` with question-specific evidence URLs.
- **419** still require independent source or answer-completeness checks; retained `review-pending` flags.
- No source-free question was silently marked Passed.
- Previously removed 18 problematic records stay excluded.
- NOGGIN overall remains **3,702 records**; there are no question-count reductions in this batch.
- Bern capital wording was clarified to specify the Swiss federal government's seat.

This is a genuine source-backed advance, **not a completed 506/506 factual certification**. The 66 Bidding categories originally flagged include open-ended questions where stored answer examples cannot cover every legitimate player response. The fixed answer matcher can reject valid entries without a host adjudication step.

## Coverage of this pass
- National capital questions: 26, cross-checked against a November 2026 published capitals register.
- Chemistry symbols: 16, checked against Royal Society of Chemistry.
- Other Buzzer factual and rule questions: 25.
- Fib Factory claims: 16, checked against published NASA, Scotland.org, Smithsonian, Met Office, Nintendo, Cambridge, Loganair and Science Museum references.
- Closed-set Bid to Win categories: 4, checked against published institutional lists.

## Verification limitations
A source URL is only recorded on cleared questions when its published content supports that precise answer. A clean machine-readable row is not proof of truth. Remaining 423 questions need detailed one-by-one evidence checks before being called Passed; especially subjective historical superlatives, variable measurements, and incomplete open Bid to Win categories.

## Technical QA
All six source-checked metadata fields remain consistent with the game's earlier test expectations; the queue now contains exactly 423 still flagged IDs. No rules, avatars, scoring, runtime audio, or graphics are edited.

## Additional four source checks
- `v3-fib-042`: Natural History Museum describes Greenland sharks as living as long as 400 years. https://www.nhm.ac.uk/discover/nine-types-of-sharks-in-the-ocean.html
- `v3-fib-046`: Smithsonian confirms that male seahorses carry eggs and give birth. https://ocean.si.edu/ocean-life/fish/longspine-seahorse
- `v3-fib-047`: WWF confirms polar bear skin is black. https://www.wwf.org.uk/learn/fascinating-facts/polar-bears
- `v3-fib-084`: Official Eiffel Tower history confirms expected lifespan of 20 years. https://www.toureiffel.paris/en/the-monument/eiffel-tower-and-science
