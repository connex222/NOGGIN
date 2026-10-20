'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const banks = ['buzzer-questions', 'fib-facts', 'close-call', 'majority-questions',
  'mind-categories', 'caption-scenes', 'sketch-words', 'unscramble',
  'higher-lower', 'noise-clues', 'bid-categories'];

function outstanding() {
  return Object.fromEntries(banks.flatMap(name => {
    const rows = JSON.parse(fs.readFileSync(path.join(root, 'data', name + '.json'), 'utf8'));
    const count = rows.filter(item => item && typeof item === 'object' &&
      (item.review === true || item.editorialStatus === 'review-pending')).length;
    return count ? [[name, count]] : [];
  }));
}

test('release audit reports editorial flags across all content banks', () => {
  const result = spawnSync(process.execPath, ['tools/release-audit.js'],
    {cwd: root, encoding: 'utf8', timeout: 30000});
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const expected = outstanding();
  assert.deepEqual(report.editorialReviewByBank, expected);
  assert.equal(report.editorialReviewPending,
    Object.values(expected).reduce((sum, number) => sum + number, 0));
});

test('editorial review flags remain present until manually signed off', () => {
  const byBank = outstanding();
  assert.equal(byBank['fib-facts'] || 0, 0, 'Fib Factory has completed editorial consistency review');
  assert.ok((byBank['bid-categories'] || 0) > 0);
});
