'use strict';
// NOGGIN v3.5.0 Batch 4 — brain content and tie-breaks: Q1, Q8.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {GameRooms} = require('./helpers/sequential-rooms');
const phase3 = require('../server/games/phase3');
const phase5 = require('../server/games/phase5');
const closeCall = require('../data/close-call.json');
const higherLower = require('../data/higher-lower.json');

function lobby(players = 3) {
  let now = 70_000;
  const rooms = new GameRooms({now: () => now, randomInt: n => crypto.randomInt(n)});
  const {code} = rooms.create('tv');
  const sockets = [];
  for (let i = 0; i < players; i++) {
    sockets.push('p' + i);
    rooms.join({code, name: 'Player ' + i, avatarId: i + 1, socketId: 'p' + i});
    rooms.setReady(code, 'p' + i, true);
  }
  rooms.startGame(code, 'tv');
  return {rooms, code, room: rooms.find(code), sockets, now: () => now, step: ms => {now += ms; rooms.sweep();}, to: t => {now = t; rooms.sweep();}};
}

// ---------- Q1 content ----------
test('Q1: 100 estimation Close Call questions, sourced and flagged for the owner', () => {
  const estimates = closeCall.filter(q => q.kind === 'estimate');
  assert.equal(estimates.length, 135);
  for (const q of estimates) {
    assert.match(q.source, /^https:\/\//, q.id);
    assert.equal(q.verified, 'needs-owner-check', q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 100_000_000, q.id);
    assert.ok(q.unit && q.question.endsWith('?'), q.id);
    assert.doesNotMatch(q.question, /how many (seconds|minutes|hours) are in \d/i, `${q.id} is arithmetic`);
  }
  // Every old item is kept, but only as a tagged fallback.
  assert.ok(closeCall.filter(q => q.kind === 'arithmetic').length >= 200);
  assert.ok(closeCall.every(q => ['estimate', 'arithmetic'].includes(q.kind)));
});

test('Q1: 150+ Higher or Lower facts in comparable groups, sourced and flagged', () => {
  const real = higherLower.filter(x => x.kind === 'fact');
  assert.ok(real.length >= 150, `only ${real.length}`);
  const groups = {};
  for (const f of real) {
    assert.match(f.source, /^https:\/\//, f.id);
    assert.equal(f.verified, 'needs-owner-check', f.id);
    assert.ok(f.group, f.id);
    (groups[f.group] ||= []).push(f);
  }
  for (const [group, items] of Object.entries(groups)) {
    assert.ok(items.length >= 7, `${group} is too small to pair well`);
    assert.equal(new Set(items.map(x => x.unit)).size, 1, `${group} mixes units`);
  }
  assert.ok(higherLower.filter(x => x.kind === 'arithmetic').length >= 350);
});

test('Q1: Higher or Lower pairs real facts from one group that are close enough to be a real question', () => {
  const byId = new Map(higherLower.map(x => [x.id, x]));
  for (let game = 0; game < 30; game++) {
    const f = lobby(2);
    phase3.start(f.room, 'brain', f.now(), crypto.randomInt, 'higher-lower');
    const m = f.room.board.minigame;
    for (let round = 0; round < 8; round++) {
      if (round) phase3.nextRound(f.room, f.now() + round * 20_000, crypto.randomInt);
      const [a, b] = m.usedIds.slice(-2).map(id => byId.get(id));
      assert.equal(a.kind, 'fact'); assert.equal(b.kind, 'fact');
      assert.equal(a.group, b.group);
      assert.notEqual(a.value, b.value);
      assert.ok(phase3.closeEnough(a.value, b.value), `${a.label} vs ${b.label} is too obvious`);
      assert.equal(m.secret.actual, b.value);
    }
  }
});

test('Q1: Close Call in play only asks estimation questions', () => {
  const f = lobby(2);
  phase3.start(f.room, 'brain', f.now(), crypto.randomInt, 'close-call');
  const used = f.room.board.minigame.usedIds;
  for (let r = 1; r < 3; r++) phase3.nextRound(f.room, f.now() + r * 20_000, crypto.randomInt);
  for (const id of used) assert.equal(closeCall.find(q => q.id === id).kind, 'estimate');
});

test('Q1: Close Call — closest wins, and an exact tie goes to the earlier answer', () => {
  const f = lobby(3);
  phase3.start(f.room, 'brain', f.now(), () => 0, 'close-call');
  f.step(5000);
  const m = f.room.board.minigame, answer = m.secret.answer, ids = f.room.players.map(p => p.id);
  f.step(100); f.rooms.inputGame(f.code, 'p2', answer + 5, m.roundKey); // first in
  f.step(100); f.rooms.inputGame(f.code, 'p0', answer + 5, m.roundKey); // same guess, later
  f.step(100); f.rooms.inputGame(f.code, 'p1', answer + 500, m.roundKey);
  f.to(m.deadline + 1);
  const result = f.room.board.minigame.lastRoundResult;
  assert.deepEqual(result.winners, [ids[2]], 'same distance: the earlier answer wins');
  assert.deepEqual(result.guesses.map(g => g.id), [ids[2], ids[0], ids[1]], 'reveal lists closest first');
  assert.ok(m.scores[ids[2]] > m.scores[ids[0]] && m.scores[ids[0]] > m.scores[ids[1]]);
});

// ---------- Q1 Noggin-Off ----------
function nogginOff(players = 2) {
  const f = lobby(players);
  f.room.board.finalists = f.room.players.slice(0, 2).map(p => p.id);
  f.room.board.stage = 'noggin-off';
  phase5.start(f.room, 'tiebreak', f.now(), null, crypto.randomInt);
  f.to(f.room.board.showdown.deadline + 1); // past the intro
  return f;
}
const answerBoth = (f, first, second, gap = 50) => {
  const m = f.room.board.showdown, correct = m.questionData.answer;
  f.step(gap); f.rooms.inputGame(f.code, f.sockets[first], correct + 3, m.roundKey);
  f.step(gap); f.rooms.inputGame(f.code, f.sockets[second], correct >= 3 ? correct - 3 : correct + 3, m.roundKey);
};

test('Q1: the Noggin-Off never uses arithmetic questions', () => {
  for (let i = 0; i < 40; i++) {
    const f = nogginOff();
    assert.equal(f.room.board.showdown.questionData.kind, 'estimate');
  }
});

test('Q1: a closest single guess wins the Noggin-Off outright', () => {
  const f = nogginOff();
  const m = f.room.board.showdown, correct = m.questionData.answer;
  f.rooms.inputGame(f.code, 'p0', correct, m.roundKey);
  f.rooms.inputGame(f.code, 'p1', correct + 1000, m.roundKey);
  assert.equal(f.room.phase, 'finished');
  assert.deepEqual(f.room.board.winnerIds, [f.room.players[0].id]);
});

test('Q1: an exact tie gets ONE replay; a second tie goes to the earliest answer', () => {
  const f = nogginOff();
  const firstQuestion = f.room.board.showdown.questionData.id;
  answerBoth(f, 1, 0);
  assert.equal(f.room.phase, 'board', 'first tie → replay');
  const replay = f.room.board.showdown;
  assert.equal(replay.kind, 'tiebreak');
  assert.equal(replay.attempt, 2);
  assert.notEqual(replay.questionData.id, firstQuestion);
  f.to(replay.deadline + 1);
  answerBoth(f, 1, 0); // player 1 answers first again, same distance
  assert.equal(f.room.phase, 'finished', 'the replay always ends the show');
  assert.deepEqual(f.room.board.winnerIds, [f.room.players[1].id]);
  assert.match(f.room.board.result.text, /answering first/);
});

test('Q1: even if nobody answers, the Noggin-Off ends after the replay', () => {
  const f = nogginOff();
  f.to(f.room.board.showdown.deadline + 1);
  assert.equal(f.room.board.showdown.attempt, 2);
  f.to(f.room.board.showdown.deadline + 1); // intro
  f.to(f.room.board.showdown.deadline + 1); // guessing time
  assert.equal(f.room.phase, 'finished');
  assert.equal(f.room.board.winnerIds.length, 1);
});

// ---------- Q8 ----------
test('Q8: reveals last 2.8 s (4 s relaxed), including after the final round', () => {
  assert.equal(phase3.REVEAL_MS, 2800);
  assert.equal(phase3.REVEAL_RELAXED_MS, 4000);
  for (const relaxed of [false, true]) {
    const f = lobby(2);
    if (relaxed) f.room.settings.timerSpeed = 'relaxed';
    phase3.start(f.room, 'brain', f.now(), () => 0, 'close-call');
    const m = f.room.board.minigame;
    let reveals = 0;
    for (let guard = 0; guard < 20 && f.room.board.step === 'minigame'; guard++) {
      const end = f.room.board.minigame.deadline;
      f.to(end + 1);
      if (f.room.board.minigame?.phase === 'reveal') {
        reveals++;
        assert.equal(f.room.board.minigame.deadline - (end + 1), relaxed ? 4000 : 2800);
      }
    }
    assert.equal(reveals, 3, 'every round, including the last, is revealed');
    assert.equal(m.finalReveal, true);
    assert.equal(f.room.board.step, 'result');
  }
});

test('Q8: the TV lists every Close Call guess and plays a reveal sting', () => {
  const fs = require('node:fs'), path = require('node:path');
  const view = fs.readFileSync(path.join(__dirname, '../public/tv/board-view.js'), 'utf8');
  const tv = fs.readFileSync(path.join(__dirname, '../public/tv/tv.js'), 'utf8');
  assert.match(view, /close-call-guesses/);
  assert.match(view, /SPOT ON!/);
  assert.match(tv, /phase==='reveal'\)audio\.play\('sfx-reel-stop'\)/);
});
