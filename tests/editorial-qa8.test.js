const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const expected = {"buzzer-questions": {"p6b2-buz-019": "Roots", "p6b2-buz-021": "October", "p6b2-buz-022": "17"}, "fib-facts": {"p6b2-fib-001": "Ag", "p6b2-fib-004": "90", "p6b2-fib-005": "Hydrogen", "p6b2-fib-011": "13"}};
test('QA8 source-reviewed answers retain proper keys and source references', () => {
  for (const [bank, entries] of Object.entries(expected)) {
    const data = require('../data/' + bank + '.json');
    for (const [id, answer] of Object.entries(entries)) {
      const item = data.find(x => x.id === id);
      assert.ok(item, id);
      assert.equal(bank === 'buzzer-questions' ? item.choices[item.correct] : item.answer, answer);
      assert.equal(item.review, false);
      assert.equal(item.editorialStatus, 'source-checked');
      assert.match(item.sourceUrl, /^https:\/\//);
    }
  }
});
