# Bid to Win — answer adjudication

When a bidder submits an unrecognised answer, the server holds it for review for up to 12 seconds, subject to the Showdown hard stop. The timer runs on the server. The VIP's phone and the host TV can approve or reject the answer; the bidder cannot judge their own answer on a VIP phone. A TV-host decision is still available when the VIP is the bidder.

Approval gives one correct answer, without adding that answer to the category's canonical global list. Rejection counts as an invalid answer (three invalid answers lose). An unanswered review is automatically rejected after the deadline, and the round continues if time remains. Up to three unknown answers can enter review per Showdown; subsequent unknown answers are rejected immediately to prevent review spam. Known synonyms still receive automatic server validation.

The proposed answer is shown to contestants during review and to the TV. This is an explicit human judgement system, not objective validation of every possible answer. The host should compare the answer to the category and judge consistently. It is not a system for verifying external factual correctness.

## Verification

Run `npm test`, `npm run check`, `npm run audit`, and `node tools/simulate.js 300`. Test with two phones and a TV, especially a VIP bidder, disconnected VIP and a timeout. Real devices have not been tested in this build.
