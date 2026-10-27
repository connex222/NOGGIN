'use strict';
// NOGGIN v3.5.0 Batch 7 — fair speed and accessibility: D7, D8.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {GameRooms} = require('./helpers/sequential-rooms');
const phase3 = require('../server/games/phase3');
const phase5 = require('../server/games/phase5');
const howto = require('../public/shared/howto.json');

function room(players = 3, settings = {}) {
  let now = 20_000;
  const rooms = new GameRooms({now: () => now, randomInt: () => 0});
  const {code} = rooms.create('tv');
  const sockets = [];
  for (let i = 0; i < players; i++) {
    sockets.push('p' + i);
    rooms.join({code, name: 'Player ' + i, avatarId: i + 1, socketId: 'p' + i});
    rooms.setReady(code, 'p' + i, true);
  }
  if (Object.keys(settings).length) rooms.setSettings(code, 'tv', settings);
  rooms.startGame(code, 'tv');
  return {rooms, code, room: rooms.find(code), sockets, now: () => now, set: t => {now = t;}, step: ms => {now += ms; rooms.sweep();}};
}

// ---------- D7 Quick Draw ----------
function quickDraw() {
  const f = room(3);
  phase3.start(f.room, 'speed', f.now(), () => 0, 'quick-draw');
  const m = f.room.board.minigame;
  f.set(m.openAt); f.rooms.sweep();
  return {f, m, tap: (i, value) => f.rooms.inputGame(f.code, f.sockets[i], value, m.roundKey)};
}

test('D7: the fastest REACTION wins Quick Draw, even if its message arrives last', () => {
  const {f, m, tap} = quickDraw();
  f.set(m.openAt + 60); tap(0, {value: 1, reactionMs: 310}); // phone near the router, slow thumb
  f.set(m.openAt + 90); tap(1, {value: 1, reactionMs: 260});
  f.set(m.openAt + 400); tap(2, {value: 1, reactionMs: 190}); // far phone, quickest thumb
  f.set(m.deadline + 1); f.rooms.sweep();
  const result = f.room.board.minigame.lastRoundResult;
  assert.deepEqual(result.winners, [f.room.players[2].id]);
  assert.deepEqual(result.reactions.map(r => r.reactionMs), [190, 260, 310]);
});

test('D7: taps before DRAW and impossibly fast taps are misfires', () => {
  const {f, m, tap} = quickDraw();
  f.set(m.openAt - 2000); tap(0, {value: 1}); // tapped during WAIT
  f.set(m.openAt + 50); tap(1, {value: 1, reactionMs: 40}); // under 100 ms: guessing
  f.set(m.openAt + 300); tap(2, {value: 1, reactionMs: 280});
  const a = f.room.board.minigame.roundAnswers;
  assert.equal(a[f.room.players[0].id].correct, false);
  assert.equal(a[f.room.players[1].id].correct, false);
  assert.equal(a[f.room.players[2].id].correct, true);
});

test('D7: reaction times longer than the round are rejected; old-style taps still work', () => {
  const {f, m, tap} = quickDraw();
  f.set(m.openAt + 100); tap(0, {value: 1, reactionMs: 999_999});
  assert.equal(f.room.board.minigame.roundAnswers[f.room.players[0].id].correct, false);
  f.set(m.openAt + 250); tap(1, 1);
  assert.equal(f.room.board.minigame.roundAnswers[f.room.players[1].id].reactionMs, 250);
  assert.throws(() => tap(2, {value: 2, reactionMs: 200}), e => e.code === 'INPUT');
});

// ---------- D7 Buzzer ----------
function buzzerDuel() {
  const f = room(2);
  f.room.board.landing = 6;
  phase5.start(f.room, 'corner', f.now(), f.room.players[1].id, () => 0);
  f.step(5001);
  const m = f.room.board.showdown;
  assert.equal(m.kind, 'buzzer');
  return {f, m, buzz: (i, reactionMs) => f.rooms.inputGame(f.code, f.sockets[i], reactionMs === undefined ? 'buzz' : {action: 'buzz', reactionMs}, f.room.board.showdown.roundKey)};
}

test('D7: buzzes are collected for 150 ms and the fastest reaction answers', () => {
  const {f, m, buzz} = buzzerDuel();
  buzz(0, 900); // arrives first, but a slower reaction
  assert.equal(m.phase, 'buzz', 'still collecting');
  f.step(80); buzz(1, 640);
  assert.equal(m.phase, 'answer', 'both in: decided at once');
  assert.equal(m.buzzId, f.room.players[1].id);
});

test('D7: a lone buzz is awarded when the 150 ms window closes', () => {
  const {f, m, buzz} = buzzerDuel();
  buzz(0, 700);
  f.step(100);
  assert.equal(m.phase, 'buzz');
  f.step(60);
  assert.equal(m.phase, 'answer');
  assert.equal(m.buzzId, f.room.players[0].id);
  assert.equal(phase5.BUZZ_WINDOW_MS, 150);
});

test('D7: phones never learn the right answer from buzzer state', () => {
  const {f, buzz} = buzzerDuel();
  buzz(0, 500);
  const pub = JSON.stringify(f.rooms.state(f.code, false, f.room.players[1].id).board.showdown);
  assert.doesNotMatch(pub, /"correct"/);
  assert.match(pub, /"buzzed":\["/);
});

// ---------- D8 ----------
test('D8: Colour-blind safe is a room setting, off by default, changeable by TV and VIP', () => {
  const f = room(2);
  assert.equal(f.room.settings.colourBlindSafe, false);
  const g = room(2, {colourBlindSafe: true});
  assert.equal(g.room.settings.colourBlindSafe, true);
});

test('D8: with it on, Colour Clash becomes Shape Clash with the same scoring', () => {
  const f = room(2, {colourBlindSafe: true});
  phase3.start(f.room, 'speed', f.now(), () => 0, 'colour-clash');
  f.step(5000);
  const m = f.room.board.minigame;
  assert.equal(phase3.publicState(f.room).title, 'Shape Clash');
  assert.equal(m.display.mode, 'shape');
  assert.ok(phase3.SHAPES.includes(m.display.shape) && phase3.SHAPES.includes(m.display.word));
  assert.notEqual(m.display.shape, m.display.word, 'the outline never matches the word');
  assert.equal(m.display.ink, undefined, 'no colour is involved');
  const right = phase3.SHAPES.indexOf(m.display.shape), wrong = (right + 1) % 4;
  f.rooms.inputGame(f.code, 'p0', right, m.roundKey);
  f.rooms.inputGame(f.code, 'p1', wrong, m.roundKey);
  f.set(m.deadline + 1); f.rooms.sweep();
  assert.equal(m.scores[f.room.players[0].id], 1);
  assert.equal(m.scores[f.room.players[1].id], -1);
});

test('D8: with it off, Colour Clash is unchanged', () => {
  const f = room(2);
  phase3.start(f.room, 'speed', f.now(), () => 0, 'colour-clash');
  const m = f.room.board.minigame;
  assert.equal(phase3.publicState(f.room).title, 'Colour Clash');
  assert.ok(phase3.COLOURS.includes(m.display.ink));
});

test('D8: TV checkbox, VIP toggle and Shape Clash how-to card exist', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert.match(read('public/tv/index.html'), /id="colourBlindSafe"/);
  assert.match(read('public/play/play.js'), /colourBlindSafe:'COLOUR-BLIND SAFE'/);
  const steps = howto['colour-clash'].colourBlindSteps;
  assert.equal(steps.length, 3);
  for (const [, text] of steps) assert.ok(text.length <= 34 && !/colou?r|ink/i.test(text), text);
});
