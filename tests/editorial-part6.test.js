const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const expected = {
  'p6b2-buz-005': '90',
  'p6b2-buz-008': 'Liverpool',
  'p6b2-buz-012': 'Six',
  'p6b2-buz-013': 'Ear',
};
test('QA part 6 independently checks answer indexes and recorded source metadata', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(root, 'data/buzzer-questions.json')));
  for (const [id, answer] of Object.entries(expected)) {
    const item = questions.find(x => x.id === id);
    assert.ok(item, `Missing ${id}`);
    assert.equal(item.choices[item.correct], answer);
    assert.equal(item.editorialStatus, 'source-checked');
    assert.equal(item.review, undefined);
    assert.match(item.sourceUrl, /^https:\/\//);
  }
});
