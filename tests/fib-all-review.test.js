'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bank = require('../data/fib-facts.json');

test('all 250 original Fib Factory entries have uniquely identified, answerable prompts and review status', () => {
  const originals = bank.filter(x => !x.id.startsWith('v3-fib-'));
  assert.equal(originals.length, 250);
  assert.equal(new Set(bank.map(x => x.id)).size, bank.length);
  for (const row of originals) {
    assert.equal(typeof row.answer, 'string', row.id);
    assert.ok(row.answer.trim(), row.id);
    assert.ok(row.question.includes('___'), row.id);
    assert.ok(row.editorialStatus && row.editorialStatus !== 'review-pending', row.id);
    if (row.editorialStatus === 'source-checked') assert.match(row.sourceUrl, /^https:\/\//, row.id);
  }
});

test('all formula-generated Fib answers are independently recalculated', () => {
  let checked = 0;
  for (const row of bank) {
    const q = row.question;
    let n;
    let match;
    if ((match = /^There are ___ seconds in (\d+) minutes$/.exec(q))) n = Number(match[1]) * 60;
    else if ((match = /^(\d+) hours contain this many minutes ___$/.exec(q))) n = Number(match[1]) * 60;
    else if ((match = /^(\d+) groups of (\d+) objects contain ___ objects\.$/.exec(q))) n = Number(match[1]) * Number(match[2]);
    else if ((match = /^A regular (\d+)-sided shape has ___ sides\.$/.exec(q))) n = Number(match[1]);
    else if ((match = /^(\d+) hours and (\d+) minutes contain ___ minutes altogether\.$/.exec(q))) n = Number(match[1]) * 60 + Number(match[2]);
    else if ((match = /^The sum of (\d+) and (\d+) is ___\.$/.exec(q))) n = Number(match[1]) + Number(match[2]);
    else if ((match = /^Twice (\d+), plus (\d+), equals ___\.$/.exec(q))) n = 2 * Number(match[1]) + Number(match[2]);
    if (n !== undefined) { assert.equal(row.answer, String(n), row.id); checked++; }
  }
  assert.equal(checked, 139);
});
