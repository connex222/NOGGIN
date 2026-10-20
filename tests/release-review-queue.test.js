const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const banks = ['buzzer-questions', 'fib-facts', 'bid-categories'];
const load = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name + '.json'), 'utf8'));

test('every source-checked entry has a usable citation and no open review flag', () => {
  for (const bank of banks) for (const item of load(bank)) {
    if (item.editorialStatus !== 'source-checked') continue;
    assert.notEqual(item.review, true, `${bank}/${item.id} retains review flag`);
    assert.match(item.sourceUrl, /^https:\/\//, `${bank}/${item.id} lacks source URL`);
    if (item.choices) {
      assert.ok(Number.isInteger(item.correct) && item.correct >= 0 && item.correct < item.choices.length);
    }
  }
});

test('editorial queue covers every still-flagged item exactly once', () => {
  const expected = banks.flatMap(bank => load(bank).filter(item => item.review === true || item.editorialStatus === 'review-pending').map(item => `${bank},${item.id},`)).sort();
  const lines = fs.readFileSync(path.join(root, 'docs/editorial/RELEASE-REVIEW-QUEUE.csv'), 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1);
  const actual = lines.map(line => line.split(',', 2).join(',') + ',').sort();
  assert.deepEqual(actual, expected);
});
