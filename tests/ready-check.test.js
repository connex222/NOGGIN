'use strict';
// Playtest fix: the how-to-play card waits until every contestant taps GOT IT.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {GameRooms} = require('../server/rooms');
const gate = require('../server/ready-gate');
const phase3 = require('../server/games/phase3');
const phase4 = require('../server/games/phase4');

function fixture(count = 3) {
  let t = 100_000;
  const rooms = new GameRooms({now: () => t, randomInt: () => 0});
  const {code} = rooms.create('tv');
  rooms.find(code).settings.roundStyle = 'sequential';
  const sock = [];
  for (let i = 0; i < count; i++) {
    sock.push('p' + i);
    rooms.join({code, name: 'Player ' + i, avatarId: i + 1, socketId: sock[i]});
    rooms.setReady(code, sock[i], true);
  }
  rooms.startGame(code, 'tv');
  const room = rooms.find(code);
  return {rooms, code, room, sock, now: () => t, step: n => {t += n; rooms.sweep();}};
}

test('new rooms default to Relaxed timers with the Ready Check on', () => {
  const rooms = new GameRooms();
  const {code} = rooms.create('tv');
  assert.equal(rooms.state(code).settings.timerSpeed, 'relaxed');
  assert.equal(rooms.state(code).settings.readyCheck, true);
});

test('a round game waits on its rules card until everyone taps GOT IT, then counts down 3 seconds', () => {
  const f = fixture(3);
  phase3.start(f.room, 'brain', f.now(), () => 0, 'close-call');
  f.step(20_000); // far longer than the old 6 s intro
  assert.equal(f.room.board.minigame.phase, 'intro');
  assert.deepEqual(f.rooms.state(f.code).board.minigame.ready.waiting.length, 3);
  f.rooms.readyGame(f.code, f.sock[0]);
  f.rooms.readyGame(f.code, f.sock[1]);
  assert.equal(f.room.board.minigame.readyReleased, false);
  f.rooms.readyGame(f.code, f.sock[2]);
  const m = f.room.board.minigame;
  assert.equal(m.readyReleased, true);
  assert.equal(m.introUntil, f.now() + gate.READY_COUNTDOWN_MS);
  assert.equal(f.rooms.state(f.code).board.minigame.ready.startsAt, m.introUntil);
  f.step(gate.READY_COUNTDOWN_MS + 1);
  assert.equal(f.room.board.minigame.phase, 'play');
  // The answer window is the full round length, measured from the real start.
  assert(f.room.board.minigame.deadline - f.now() > 9_000);
});

test('answers are refused during the ready check', () => {
  const f = fixture(2);
  phase3.start(f.room, 'brain', f.now(), () => 0, 'close-call');
  assert.throws(() => f.rooms.inputGame(f.code, f.sock[0], 5, f.room.board.minigame.roundKey), e => e.code === 'WAIT');
});

test('an offline phone is never waited for', () => {
  const f = fixture(3);
  phase3.start(f.room, 'speed', f.now(), () => 0, 'colour-clash');
  f.room.players[2].socketId = null;
  f.rooms.readyGame(f.code, f.sock[0]);
  f.rooms.readyGame(f.code, f.sock[1]);
  f.step(gate.READY_MIN_MS + 1);
  assert.equal(f.room.board.minigame.readyReleased, true);
});

test('the TV host can start the game early, and the safety cap starts it anyway', () => {
  const f = fixture(2);
  phase4.start(f.room, 'together', f.now(), () => 0, 'majority-rules');
  f.rooms.startNowGame(f.code, 'tv');
  f.step(gate.READY_COUNTDOWN_MS + 1);
  assert.equal(f.room.board.minigame.phase, 'play');

  const g = fixture(2);
  phase4.start(g.room, 'together', g.now(), () => 0, 'majority-rules');
  g.step(gate.READY_CAP_MS + 1);
  assert.notEqual(g.room.board.minigame.phase, 'intro');
});

test('only contestants can ready up; only the TV or VIP can press START NOW', () => {
  const f = fixture(3);
  phase3.start(f.room, 'brain', f.now(), () => 0, 'unscramble');
  assert.throws(() => f.rooms.startNowGame(f.code, f.sock[1]), e => e.code === 'AUTH');
  f.rooms.readyGame(f.code, f.sock[0]);
  f.rooms.readyGame(f.code, f.sock[0]); // a double tap is harmless
  assert.deepEqual(f.room.board.minigame.readyIds, [f.room.players[0].id]);
});
