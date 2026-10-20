const test = require('node:test');
const assert = require('node:assert/strict');
const bank = require('../data/buzzer-questions.json');
const ids = new Map(Object.entries({"p6b2-buz-003": "Thermometer", "p6b2-buz-007": "Indian Ocean", "p6b2-buz-011": "Chickpeas", "p6b2-buz-015": "Amphibian", "p6b2-buz-016": "Africa", "p6b2-buz-018": "Badminton", "p6b2-buz-023": "Lamb"}));
test('new externally source-checked buzzer entries retain answer keys and citations', () => {
 for (const [id, expected] of ids) {
  const item = bank.find(question => question.id === id);
  assert.ok(item, id);
  assert.equal(item.choices[item.correct], expected);
  assert.equal(item.editorialStatus, 'source-checked');
  assert.match(item.sourceUrl, /^https:\/\//);
  assert.equal(item.review, false);
 }
});
