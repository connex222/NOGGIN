'use strict';
// NOGGIN v3.5.0 Batch 6 — answer matching: Q3, Q4, Q5, Q6.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {GameRooms} = require('./helpers/sequential-rooms');
const phase3 = require('../server/games/phase3');
const phase4 = require('../server/games/phase4');
const phase5 = require('../server/games/phase5');
const match = require('../server/answer-match');
const unscramble = require('../data/unscramble.json');
const sketch = require('../data/sketch-words.json');
const noise = require('../data/noise-clues.json');
const buzzer = require('../data/buzzer-questions.json');

function room(players = 3) {
  let now = 30_000;
  const rooms = new GameRooms({now: () => now, randomInt: () => 0});
  const {code} = rooms.create('tv');
  const sockets = [];
  for (let i = 0; i < players; i++) {
    sockets.push('p' + i);
    rooms.join({code, name: 'Player ' + i, avatarId: i + 1, socketId: 'p' + i});
    rooms.setReady(code, 'p' + i, true);
  }
  rooms.startGame(code, 'tv');
  const r = rooms.find(code);
  return {rooms, code, room: r, sockets, now: () => now, step: ms => {now += ms; rooms.sweep();}};
}

// ---------- Q3 ----------
test('Q3: every anagram pair from the brief is accepted either way round', () => {
  const pairs = [['OCEANS', 'CANOES'], ['METEOR', 'REMOTE'], ['FOREST', 'FOSTER'], ['FOREST', 'SOFTER'], ['SEASIDE', 'DISEASE'], ['PARROTS', 'RAPTORS'],
    ['BAKERS', 'BRAKES'], ['BAKERS', 'BREAKS'], ['LOBSTER', 'BOLSTER'], ['SILENCE', 'LICENSE'], ['GARDENS', 'DANGERS'], ['PAINTER', 'REPAINT'],
    ['PAINTER', 'PERTAIN'], ['ARTISTS', 'STRAITS'], ['GRAPES', 'PAGERS'], ['MARBLE', 'RAMBLE'], ['POSTERS', 'PRESTOS']];
  for (const [word, alt] of pairs) {
    const item = unscramble.find(x => x.word === word);
    assert.ok(item, word);
    assert.ok((item.accept || []).includes(alt), `${word} should accept ${alt}`);
  }
});

test('Q3: an accepted anagram scores in play, and the scramble never shows an accepted word', () => {
  const f = room(2);
  const item = unscramble.find(x => x.word === 'OCEANS');
  phase3.start(f.room, 'brain', f.now(), () => 0, 'unscramble');
  const m = f.room.board.minigame;
  m.secret = {answer: 'OCEANS', accept: ['OCEANS', ...item.accept]};
  f.step(5000);
  f.rooms.inputGame(f.code, 'p0', 'canoes', m.roundKey);
  assert.equal(m.roundAnswers[f.room.players[0].id]?.correct, true);
  for (let i = 0; i < 300; i++) {
    const s = phase3.safeScramble('OCEANS', crypto.randomInt, item.accept);
    assert.ok(s !== 'OCEANS' && s !== 'CANOES', s);
  }
});

test('Q3: every Unscramble word has a specific category clue', () => {
  for (const x of unscramble) assert.ok(!['Everyday words', 'Things and objects', 'Objects', 'Nature and space'].includes(x.category), `${x.word}: ${x.category}`);
});

// ---------- Q4 Sketch ----------
function sketchRound(word) {
  const f = room(4);
  f.room.board.activeId = f.room.players[0].id;
  phase4.start(f.room, 'create', f.now(), () => 0, 'sketch-sabotage');
  const item = sketch.find(x => x.word === word);
  const m = f.room.board.minigame;
  m.secret.word = item.word; m.secret.accept = item.accept || []; m.secret.saboteur = null;
  f.step(5001);
  const guess = (i, text) => f.rooms.inputGame(f.code, f.sockets[i], text, f.room.board.minigame?.roundKey);
  return {f, m, guess};
}

test('Q4: Sketch accepts fair alternatives, plurals, hyphens and "the"', () => {
  for (const [word, guess] of [['HOT AIR BALLOON', 'balloon'], ['HOT AIR BALLOON', 'Hot-air balloons'], ['ROLLER SKATES', 'the roller skate'],
    ['DOUBLE-DECKER BUS', 'double decker bus'], ['BLACK CAB', 'taxi'], ['VACUUM CLEANER', 'hoover']]) {
    const {f, m, guess: g} = sketchRound(word);
    g(1, guess);
    assert.equal(m.secret.guesser, f.room.players[1].id, `${guess} → ${word}`);
  }
});

test('Q4: a near miss gets a private "Close!" and the answer is never revealed', () => {
  const {f, m, guess} = sketchRound('HOT AIR BALLOON');
  guess(1, 'air');
  assert.equal(m.secret.guesser, undefined);
  const mine = f.rooms.state(f.code, false, f.room.players[1].id).board.minigame;
  assert.equal(mine.private.guessFeedback.result, 'close');
  const theirs = f.rooms.state(f.code, false, f.room.players[2].id).board.minigame;
  assert.equal(theirs.private?.guessFeedback, undefined, 'feedback is private');
  assert.ok(!JSON.stringify(mine).includes('BALLOON'), 'the answer stays secret');
  guess(1, 'giraffe');
  assert.equal(f.rooms.state(f.code, false, f.room.players[1].id).board.minigame.private.guessFeedback.result, 'miss');
});

test('Q4: Sketch has no duplicate prompts and no squashed words', () => {
  const seen = new Set();
  for (const x of sketch) {
    const k = match.canon(x.word);
    assert.ok(!seen.has(k), x.word); seen.add(k);
  }
  for (const w of ['ICECREAM', 'BIRTHDAYCAKE', 'FIREENGINE', 'BOWTIE']) assert.ok(!sketch.some(x => x.word === w), w);
  assert.equal(sketch.length, 500);
});

// ---------- Q4 Noise ----------
function noiseRound(id) {
  const f = room(3);
  f.room.board.activeId = f.room.players[0].id;
  phase4.start(f.room, 'create', f.now(), () => 0, 'noise-annoys');
  const clue = noise.find(x => x.id === id);
  const m = f.room.board.minigame;
  m.secret = {answer: clue.clue, aliases: clue.aliases};
  f.step(5001);
  return {f, m, guess: (i, text) => f.rooms.inputGame(f.code, f.sockets[i], text, f.room.board.minigame?.roundKey)};
}

test('Q4: Noise wins only on the key nouns — 3-letter aliases work, filler words do not', () => {
  const owl = noiseRound('p6final-no-012'); // an owl hooting at night
  owl.guess(1, 'night');
  assert.equal(owl.m.secret.guesser, undefined, '"night" must not win');
  assert.equal(owl.f.rooms.state(owl.f.code, false, owl.f.room.players[1].id).board.minigame.private.guessFeedback.result, 'close');
  owl.guess(1, 'an owl');
  assert.equal(owl.m.secret.guesser, owl.f.room.players[1].id);

  const wet = noiseRound('no-p6-007'); // a dog shaking water off its coat
  wet.guess(1, 'water');
  assert.equal(wet.m.secret.guesser, undefined, '"water" must not win');
  wet.guess(2, 'wet dog shaking');
  assert.equal(wet.m.secret.guesser, wet.f.room.players[2].id);
});

test('Q4: no fragment matching — "bowling" does not hit "owl"', () => {
  assert.equal(match.containsPhrase('bowling', 'owl'), false);
  assert.equal(match.containsPhrase('owl hooting', 'owl'), true);
});

test('Q4: every Noise clue has key-noun aliases', () => {
  for (const x of noise) {
    assert.ok(Array.isArray(x.aliases) && x.aliases.length, x.id);
    for (const a of x.aliases) assert.ok(a.length >= 2, `${x.id}: ${a}`); // e.g. "owl", "f1"
  }
});

// ---------- Q5 ----------
test('Q5: number words and digits are the same answer', () => {
  for (const [a, b] of [['5', 'five'], ['Four', '4'], ['ten', '10'], ['forty', '40'], ['two hundred', '200'], ['a hundred', '100'], ['forty-two', '42'], ['seventy five', '75']]) {
    assert.ok(match.same(a, b), `${a} = ${b}`);
  }
  assert.ok(!match.same('five', '50'));
});

test('Q5: typing "5" for the truth "five" in Fib Factory counts as finding the truth, not a fib', () => {
  const f = room(3);
  phase4.start(f.room, 'create', f.now(), () => 0, 'fib-factory');
  const m = f.room.board.minigame;
  m.secret.answer = 'five';
  f.step(5001);
  f.rooms.inputGame(f.code, 'p0', '5', m.roundKey);
  assert.deepEqual(m.answers[f.room.players[0].id], {text: null, guessedTruth: true});
  f.rooms.inputGame(f.code, 'p1', 'six', m.roundKey);
  assert.throws(() => f.rooms.inputGame(f.code, 'p2', '6', m.roundKey), e => e.code === 'INPUT', '"6" duplicates "six"');
});

// ---------- Q6 ----------
const general = buzzer.filter(q => q.topic !== 'maths');
test('Q6: every general question has a difficulty, near a 40/40/20 mix', () => {
  for (const q of general) assert.ok(['easy', 'medium', 'hard'].includes(q.difficulty), q.id);
  const share = d => general.filter(q => q.difficulty === d).length / general.length;
  assert.ok(Math.abs(share('easy') - 0.4) <= 0.05, `easy ${share('easy')}`);
  assert.ok(Math.abs(share('medium') - 0.4) <= 0.05, `medium ${share('medium')}`);
  assert.ok(Math.abs(share('hard') - 0.2) <= 0.05, `hard ${share('hard')}`);
});

test('Q6: 120+ new sourced medium/hard questions with four distinct choices', () => {
  const fresh = buzzer.filter(q => q.id.startsWith('v35-buz-'));
  assert.ok(fresh.length >= 120);
  for (const q of fresh) {
    assert.ok(['medium', 'hard'].includes(q.difficulty), q.id);
    assert.match(q.sourceUrl, /^https:\/\//);
    assert.equal(q.verified, 'needs-owner-check');
    assert.equal(new Set(q.choices.map(c => c.toLowerCase())).size, 4, q.id);
  }
});

test('Q6: listed duplicates are gone, planets capped at five, Angel of the North reworded', () => {
  const ids = new Set(buzzer.map(q => q.id));
  for (const [a, b] of [['buzz-081', 'p6b6-buzz-011'], ['p6b2-buz-010', 'p6b6-buzz-002'], ['buzz-100', 'p6b2-buz-004'], ['buzz-087', 'p6b2-buz-001'], ['buzz-091', 'p6b2-buz-020'], ['buzz-089', 'v3-buz-090']]) {
    assert.ok(!(ids.has(a) && ids.has(b)), `${a} / ${b}`);
  }
  // Astronomy questions about planets (Holst's music suite "The Planets" doesn't count).
  const planets = general.filter(q => q.topic !== 'arts' && /\bplanet|solar system\b/i.test(q.question));
  assert.ok(planets.length <= 5, planets.map(q => q.id).join(', '));
  assert.equal(buzzer.find(q => q.id === 'v3-buz-031').question, 'Which town is home to the Angel of the North?');
});

test('Q6: a duel climbs easy → medium → hard, and answers are shuffled every time', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(i => phase5.buzzerLevel(i, 7)), ['easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard']);
  // Batch 8 (G2) shortened duels to 5 questions: 2 easy, 2 medium, 1 hard.
  assert.deepEqual([1, 2, 3, 4, 5].map(i => phase5.buzzerLevel(i, 5)), ['easy', 'easy', 'medium', 'medium', 'hard']);
  const byId = new Map(buzzer.map(q => [q.id, q]));
  for (let game = 0; game < 10; game++) {
    const f = room(2);
    f.room.board.landing = 6;
    phase5.start(f.room, 'corner', f.now(), f.room.players[1].id, () => 0);
    const m = f.room.board.showdown;
    assert.equal(m.kind, 'buzzer');
    for (let guard = 0; guard < 40 && f.room.board.showdown === m; guard++) f.step(Math.max(1, m.deadline - f.now() + 1));
    const levels = m.used.map(id => byId.get(id).difficulty);
    assert.deepEqual(levels, ['easy', 'easy', 'medium', 'medium', 'hard'].slice(0, levels.length));
  }
  const q = general[0], positions = [0, 0, 0, 0];
  for (let i = 0; i < 2000; i++) {
    const s = phase5.shuffled(q);
    assert.equal(s.choices[s.correct], q.choices[q.correct]);
    positions[s.correct]++;
  }
  for (const n of positions) assert.ok(n > 350, `answer positions should be even: ${positions}`);
});
