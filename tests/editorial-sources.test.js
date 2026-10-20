const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const expected = new Map([
  ['p6b2-buz-004', 'Au'],
  ['p6b2-buz-009', 'Nitrogen'],
  ['p6b2-buz-010', 'Jupiter'],
  ['p6b2-buz-014', 'Magma'],
  ['p6b2-buz-017', 'Equator'],
  ['p6b2-buz-020', 'H₂O'],
  ['fb-006', '8'],
]);
test('source-checked questions retain correct keyed answers and citation metadata', () => {
  const banks = ['buzzer-questions', 'fib-facts'];
  const found = new Set();
  for (const bank of banks) {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'data', `${bank}.json`)));
    for (const item of data) {
      if (!expected.has(item.id)) continue;
      found.add(item.id);
      const answer = item.choices ? item.choices[item.correct] : item.answer;
      assert.equal(answer, expected.get(item.id));
      assert.equal(item.editorialStatus, 'source-checked');
      assert.match(item.sourceUrl, /^https:\/\//);
      assert.notEqual(item.review, true);
    }
  }
  assert.deepEqual([...found].sort(), [...expected.keys()].sort());
});
