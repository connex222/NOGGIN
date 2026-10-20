const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', `${name}.json`), 'utf8'));

test('Phase 6 batch 6 exact-answer problems are recalculated independently', () => {
  const rows = read('close-call').filter(row => row.id.startsWith('p6b6-'));
  assert.equal(rows.length, 21);
  for (const row of rows) {
    const { type, a, b } = row.calc;
    const expected = type === 'rectangle' ? a * b : type === 'stools' ? a * b : a * 60 + b;
    assert.equal(row.answer, expected, row.id);
  }
});
test('Phase 6 batch 6 multiple-choice bank has a unique correct answer', () => {
  const rows = read('buzzer-questions').filter(row => row.id.startsWith('p6b6-'));
  assert.equal(rows.length, 14);
  for (const row of rows) {
    assert.equal(row.choices.length, 4);
    assert.equal(new Set(row.choices.map(s => s.toLowerCase())).size, 4);
    assert.ok(row.choices[row.correct]);
    assert.equal(row.verified, 'publisher-checked');
    assert.ok(row.source.startsWith('https://science.nasa.gov/'));
  }
});
test('Phase 6 batch 6 bid categories carry distinct illustrative answers', () => {
  const rows = read('bid-categories').filter(row => row.id.startsWith('p6b6-'));
  assert.equal(rows.length, 10);
  for (const row of rows) {
    assert.equal(row.answers.length, 8);
    assert.equal(new Set(row.answers.map(s => s.toLowerCase())).size, 8);
    assert.equal(row.review, true);
  }
});
