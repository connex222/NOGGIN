'use strict';
// NOGGIN v3.5.0 Batch 5 — Bid to Win fairness: G3, D10, Q7.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {GameRooms} = require('./helpers/sequential-rooms');
const phase5 = require('../server/games/phase5');
const {acceptedAnswer, normalise} = require('../server/bid-answers');
const bids = require('../data/bid-categories.json');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function bidDuel(players = 3) {
  let now = 40_000;
  const rooms = new GameRooms({now: () => now, randomInt: () => 0});
  const {code} = rooms.create('tv');
  const phones = [];
  for (let i = 0; i < players; i++) {
    phones.push('p' + i);
    rooms.join({code, name: 'Player ' + i, avatarId: i + 1, socketId: 'p' + i});
    rooms.setReady(code, 'p' + i, true);
  }
  rooms.startGame(code, 'tv');
  const room = rooms.find(code);
  room.board.landing = 18; // the Bid to Win corner
  phase5.start(room, 'corner', now, room.players[1].id, () => 0);
  now += 5001; rooms.sweep();
  const m = room.board.showdown;
  return {rooms, code, room, phones, m, input: (i, v) => rooms.inputGame(code, phones[i], v, room.board.showdown.roundKey), advance: ms => {now += ms; rooms.sweep();}};
}

// ---------- G3 ----------
test('G3: the rival bids first, not the player who landed on the corner', () => {
  const f = bidDuel(2);
  assert.equal(f.m.kind, 'bid');
  assert.equal(f.m.participants[0], f.room.players[0].id, 'player 0 landed');
  assert.equal(f.m.turnId, f.room.players[1].id, 'player 1 (the rival) opens the bidding');
  assert.throws(() => f.input(0, {action: 'bid', count: 1}), e => e.code === 'TURN');
  f.input(1, {action: 'bid', count: 1});
  assert.equal(f.m.turnId, f.room.players[0].id);
});

// ---------- D10 ----------
function toReview(f, text = 'something unlisted') {
  f.input(1, {action: 'bid', count: 3});
  f.input(0, {action: 'challenge'});
  f.input(1, text);
  assert.equal(f.m.phase, 'review');
}

test('D10: neither duellist can judge — not even the VIP', () => {
  const f = bidDuel(3);
  assert.equal(f.room.vipId, f.room.players[0].id, 'the VIP is in the duel');
  toReview(f);
  assert.throws(() => f.rooms.adjudicateBid(f.code, f.phones[0], true), e => e.code === 'AUTH' && /Duellists cannot judge/.test(e.message));
  assert.throws(() => f.rooms.adjudicateBid(f.code, f.phones[1], true), e => e.code === 'AUTH');
});

test('D10: any non-duelling player can judge, and the first decision wins', () => {
  const f = bidDuel(4);
  toReview(f);
  f.rooms.adjudicateBid(f.code, f.phones[3], true); // a non-VIP spectator
  assert.equal(f.m.guesses.length, 1);
  assert.throws(() => f.rooms.adjudicateBid(f.code, f.phones[2], false), e => e.code === 'STEP' && /already been judged/.test(e.message));
  assert.throws(() => f.rooms.adjudicateBid(f.code, 'tv', false), e => e.code === 'STEP');
  assert.equal(f.m.invalid, 0);
});

test('D10: the TV can always judge', () => {
  const f = bidDuel(2);
  toReview(f);
  f.rooms.adjudicateBid(f.code, 'tv', false);
  assert.equal(f.m.invalid, 1);
});

test('D10: phones show the answer and judging buttons only to non-duellists', () => {
  const f = bidDuel(3);
  toReview(f, 'Wensleydale');
  const spectator = f.rooms.state(f.code, false, f.room.players[2].id).board.showdown;
  assert.equal(spectator.display.review.text, 'Wensleydale', 'judges see what was typed, not a squashed form');
  const phone = read('public/play/play.js');
  assert.match(phone, /THE TV OR ANOTHER PLAYER WILL JUDGE/);
  assert.match(phone, /YOU ARE A JUDGE · THE FIRST DECISION COUNTS/);
  assert.doesNotMatch(phone, /THE VIP WILL DECIDE/);
  assert.match(read('public/tv/tv.js'), /any phone that is not in the duel/);
});

// ---------- Q7 ----------
test('Q7: unlimited reviews — every unlisted answer goes to the judges', () => {
  const f = bidDuel(3);
  f.input(1, {action: 'bid', count: 8});
  f.input(0, {action: 'challenge'});
  for (let i = 0; i < 6; i++) {
    f.input(1, `made up answer ${i}`);
    assert.equal(f.m.phase, 'review', `answer ${i + 1} should be reviewed`);
    f.rooms.adjudicateBid(f.code, f.phones[2], true);
  }
  assert.equal(f.m.guesses.length, 6);
  assert.equal(f.m.invalid, 0);
});

test('Q7: trivial, silly and wrongly-worded categories are gone', () => {
  const ids = new Set(bids.map(b => b.id));
  for (const id of ['bid-11', 'bid-14', 'bid-16', 'bid-21', 'p6b6-bid-010', 'bid-01', 'bid-02', 'bid-20']) assert.ok(!ids.has(id), id);
  for (const b of bids) assert.doesNotMatch(b.prompt, /letters in the word|faces of a|first ten positive/i, b.id);
});

test('Q7: open everyday categories have 40+ accepted answers', () => {
  const open = bids.filter(b => b.kind === 'open');
  assert.ok(open.length >= 25);
  for (const b of open) assert.ok(b.answers.length >= 40, `${b.id} has ${b.answers.length}`);
  for (const id of ['p6final-bid-033', 'p6b4-bid-002']) assert.equal(bids.find(b => b.id === id).kind, 'open', 'fruit and kitchen are open categories');
});

test('Q7: numbers in a prompt match the size of a closed list', () => {
  const words = {four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12};
  for (const b of bids.filter(x => x.kind === 'closed')) {
    const match = b.prompt.toLowerCase().match(/\b(four|five|six|seven|eight|nine|ten|eleven|twelve)\b/);
    if (match) assert.equal(b.answers.length, words[match[1]], `${b.id}: "${b.prompt}"`);
  }
});

test('Q7: aliases point at real answers and are accepted', () => {
  for (const b of bids) {
    for (const [answer, list] of Object.entries(b.aliases || {})) {
      const index = b.answers.indexOf(answer);
      assert.ok(index >= 0, `${b.id}: alias key ${answer}`);
      for (const alias of list) assert.equal(acceptedAnswer(b, alias), index, `${b.id}: ${alias} → ${answer}`);
    }
  }
  const fruit = bids.find(b => b.id === 'p6final-bid-033');
  assert.ok(acceptedAnswer(fruit, 'kiwi fruit') >= 0);
  const travel = bids.find(b => b.id === 'p6b4-bid-007');
  assert.equal(acceptedAnswer(travel, 'Bike'), travel.answers.indexOf('Cycle'));
});

test('Q7: no two answers in a category look the same once tidied', () => {
  for (const b of bids) assert.equal(new Set(b.answers.map(normalise)).size, b.answers.length, b.id);
});
