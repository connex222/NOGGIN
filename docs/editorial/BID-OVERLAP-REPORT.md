# Bid to Win — post-fix overlap audit

All 120 categories were evaluated for overlap using lowercased, punctuation-normalised answer sets. **32 categories were rewritten** while retaining their IDs.

**Result: 0 pairs** with at least 75% overlap of the smaller accepted-answer list (previously 41 pairs). This is a mechanical answer-overlap measure, not semantic uniqueness.

**Outstanding:** Many category prompts accept real-world answers outside the eight stored examples. Such answers could be unfairly rejected. Existing `review` flags are deliberately retained, and the rewritten 32 categories also remain flagged until validated. This work is a significant variety fix, not complete editorial verification.

See `BID-FIXES-CHANGELOG.csv` for the exact rewritten IDs.
