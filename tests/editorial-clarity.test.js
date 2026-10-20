'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fib = require('../data/fib-facts.json');
const bids = require('../data/bid-categories.json');

const byId = (bank, id) => {
  const item = bank.find(entry => entry.id === id);
  assert.ok(item, `Missing editorial entry ${id}`);
  return item;
};

test('ambiguous existing facts now state precise conditions without altering their answers', () => {
  const chess = byId(fib,'fb-001');
  assert.match(chess.question, /individual small squares/i);
  assert.equal(chess.answer,'64');
  const football = byId(fib,'fb-004');
  assert.match(football.question,/each team/i);
  assert.equal(football.answer,'11');
  for (const id of ['fb-033','fb-034']) {
    assert.match(byId(fib,id).question, /one atmosphere/i);
  }
  assert.equal(byId(fib,'fb-044').answer,'bee');
  assert.match(byId(fib,'fb-059').question,/Monday-to-Friday/i);
  assert.match(byId(fib,'fb-054').question,/New York/i);
});

test('bidding answers are distinguishable and prompts specify their scope', () => {
  const guitar = byId(bids,'p6b2-bid-003');
  assert.equal(guitar.answers.length,6);
  assert.equal(new Set(guitar.answers.map(a=>a.toLowerCase())).size,6);
  assert.deepEqual(guitar.answers,['Low E','A','D','G','B','High E']);
  const swim = byId(bids,'p6b2-bid-010');
  assert.match(swim.prompt,/individual medley/i);
  const recycle = byId(bids,'p6final-bid-026');
  assert.match(recycle.prompt,/local collection rules/i);
});

test('edited Fib questions record completed editorial review without claiming source verification', () => {
  const ids=['fb-001','fb-004','fb-033','fb-034','fb-044','fb-059','fb-054'];
  for (const id of ids) {
    assert.notEqual(byId(fib,id).editorialStatus,'review-pending');
    assert.notEqual(byId(fib,id).editorialStatus,'source-checked');
  }
  for (const id of ['p6b2-bid-003','p6b2-bid-010','p6final-bid-026']) {
    assert.equal(byId(bids,id).review,true);
  }
});
