'use strict';
// NOGGIN v3.5.0 Batch 1 — game-night blockers: D1, D2, D9, G4, G5, Q2.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {attachGateway} = require('../server/gateway');
const {GameRooms} = require('./helpers/sequential-rooms');
const phase3 = require('../server/games/phase3');
const phase4 = require('../server/games/phase4');
const unscramble = require('../data/unscramble.json');
const sketch = require('../data/sketch-words.json');

class FakeSocket {
  constructor(id) {this.id = id; this.events = new Map(); this.out = []; this.rooms = new Set(); this.handshake = {address: '192.168.1.50'}; this.request = {headers: {host: 'localhost:3000'}, secure: false, socket: {remoteAddress: '192.168.1.50'}};}
  on(name, fn) {this.events.set(name, fn);}
  join(code) {this.rooms.add(code);}
  leave(code) {this.rooms.delete(code);}
  emit(name, payload) {this.out.push({name, payload});}
  send(name, payload = {}) {return new Promise(resolve => this.events.get(name)(payload, resolve));}
}
class FakeIO {
  constructor() {this.sockets = {sockets: new Map()}; this.broadcasts = [];}
  on(name, handler) {this.connections = handler;}
  connect(socket) {this.sockets.sockets.set(socket.id, socket); this.connections(socket); return socket;}
  to(code) {return {emit: (name, payload) => this.broadcasts.push({code, name, payload})};}
  in() {return {socketsLeave: () => {}};}
}
const fakeQRCode = {toDataURL: async url => `data:image/mock,${url}`};

function lobby(players = 2, game = null) {
  let now = 50_000;
  const rooms = new GameRooms({now: () => now, randomInt: () => 0});
  const {code} = rooms.create('tv');
  const sockets = [];
  for (let i = 0; i < players; i++) {
    sockets.push('p' + i);
    rooms.join({code, name: 'Player ' + i, avatarId: i + 1, socketId: 'p' + i});
    rooms.setReady(code, 'p' + i, true);
  }
  rooms.startGame(code, 'tv');
  const room = rooms.find(code);
  return {rooms, code, room, sockets, step: ms => {now += ms; rooms.sweep();}, now: () => now, setNow: t => {now = t;}};
}

// ---------- D1 ----------
test('D1: a phone that resumes twice on the same connection keeps its seat', async () => {
  const io = new FakeIO(); const gateway = attachGateway(io, {QRCode: fakeQRCode});
  try {
    const tv = io.connect(new FakeSocket('tv'));
    const created = await tv.send('room:create', {});
    const phone = io.connect(new FakeSocket('phone'));
    const joined = await phone.send('room:join', {code: created.code, name: 'Alice', avatarId: 1});
    // Simulate a refresh: a brand-new connection resumes, then asks again.
    const fresh = io.connect(new FakeSocket('phone-2'));
    const first = await fresh.send('room:resume', {code: created.code, token: joined.token, role: 'player'});
    const second = await fresh.send('room:resume', {code: created.code, token: joined.token, role: 'player'});
    assert.equal(first.ok, true);
    assert.equal(second.ok, true, second.message);
    assert.equal(second.playerId, joined.playerId);
    assert.equal(gateway.rooms.find(created.code).players[0].socketId, 'phone-2');
    assert.equal((await fresh.send('room:ready', {ready: true})).ok, true);
  } finally {gateway.stop();}
});

test('D1: the TV can also resume twice on one connection and still gets its QR code', async () => {
  const io = new FakeIO(); const gateway = attachGateway(io, {QRCode: fakeQRCode});
  try {
    const tv = io.connect(new FakeSocket('tv'));
    const created = await tv.send('room:create', {});
    const again = await tv.send('room:resume', {code: created.code, token: created.token, role: 'host'});
    assert.equal(again.ok, true, again.message);
    assert.match(again.qrDataUrl, /^data:/);
  } finally {gateway.stop();}
});

test('D1: a bound socket still cannot switch to a different seat', async () => {
  const io = new FakeIO(); const gateway = attachGateway(io, {QRCode: fakeQRCode});
  try {
    const tv = io.connect(new FakeSocket('tv'));
    const created = await tv.send('room:create', {});
    const a = io.connect(new FakeSocket('a')), b = io.connect(new FakeSocket('b'));
    await a.send('room:join', {code: created.code, name: 'Alice', avatarId: 1});
    const bob = await b.send('room:join', {code: created.code, name: 'Bobby', avatarId: 2});
    const stolen = await a.send('room:resume', {code: created.code, token: bob.token, role: 'player'});
    assert.equal(stolen.ok, false);
    assert.equal(stolen.code, 'BOUND');
    assert.equal(gateway.rooms.find(created.code).players[1].socketId, 'b');
  } finally {gateway.stop();}
});

// ---------- D2 ----------
test('D2: every Speed and Brain game opens on its rules card and refuses early answers', () => {
  for (const {id, category} of phase3.CATALOG) {
    const f = lobby(3);
    phase3.start(f.room, category, f.now(), () => 0, id);
    const m = f.room.board.minigame;
    assert.equal(m.phase, 'intro', id);
    assert.ok(m.introUntil > f.now(), id);
    assert.throws(() => phase3.submit(f.room, f.room.players[0].id, 1, m.roundKey, f.now() + 10), e => e.code === 'WAIT', id);
    f.step(6100);
    assert.notEqual(f.room.board.minigame.phase, 'intro', id);
  }
});

test('D2: relaxed timers give a longer rules card', () => {
  const f = lobby(2);
  f.room.settings.timerSpeed = 'relaxed';
  phase3.start(f.room, 'brain', f.now(), () => 0, 'close-call');
  assert.equal(f.room.board.minigame.introUntil - f.now(), 6000);
});

// ---------- D9 ----------
test('D9: a VIP phone that pauses never receives TV-only cues', () => {
  const f = lobby(3);
  phase3.start(f.room, 'speed', f.now(), () => 0, 'count-flash');
  f.step(5000);
  const vipSocket = f.sockets[0];
  assert.equal(f.room.vipId, f.room.players[0].id);
  const paused = JSON.stringify(f.rooms.pauseGame(f.code, vipSocket));
  assert.ok(!paused.includes('"tvCue"'));
  const resumed = JSON.stringify(f.rooms.resumeGame(f.code, vipSocket));
  assert.ok(!resumed.includes('"tvCue"'));
  f.rooms.pauseGame(f.code, 'tv');
  const tv = f.rooms.resumeGame(f.code, 'tv');
  assert.ok(tv.board.minigame.tvCue, 'the TV still gets its cue');
});

test('D9: a VIP phone keeps its own private card after a host action', () => {
  const f = lobby(2);
  phase4.start(f.room, 'together', f.now(), () => 0, 'relay-sums');
  f.step(5001);
  const state = f.rooms.pauseGame(f.code, f.sockets[0]);
  assert.equal(state.board.minigame.private?.role, 'relay-solver');
});

// ---------- G4 ----------
test('G4: Relay teams always get the same number of sums, for 2 to 8 players', () => {
  for (let n = 2; n <= 8; n++) {
    const ids = Array.from({length: n}, (_, i) => 'x' + i);
    const {teams, tasks} = phase4.makeSums(ids, () => 0);
    assert.equal(tasks[0].length, tasks[1].length, `${n} players`);
    // Every sum is owned by a member of its own team.
    tasks.forEach((list, t) => list.forEach(task => assert.ok(teams[t].includes(task.id))));
  }
});

test('G4: with 5 players the smaller team can still win by finishing first', () => {
  const f = lobby(5);
  phase4.start(f.room, 'together', f.now(), () => 0, 'relay-sums');
  f.step(5001);
  const m = f.room.board.minigame;
  const small = m.display.teams[1];
  assert.equal(small.length, 2);
  for (const task of m.secret.tasks[1]) {
    const socket = f.sockets[f.room.players.findIndex(p => p.id === task.id)];
    f.rooms.inputGame(f.code, socket, task.answer, f.room.board.minigame.roundKey);
  }
  assert.equal(f.room.board.step, 'result');
  for (const p of f.room.players) assert.equal(p.sparks, small.includes(p.id) ? 1 : 0, p.name);
});

// ---------- G5 ----------
test('G5: the host keeps their Spark when everybody ties in a Speed or Brain game', () => {
  const f = lobby(3);
  phase3.start(f.room, 'brain', f.now(), () => 0, 'unscramble');
  const host = f.room.players.find(p => p.id === f.room.board.activeId);
  host.sparks = 3;
  for (let guard = 0; guard < 20 && f.room.board.step === 'minigame'; guard++) {
    f.setNow(f.room.board.minigame.deadline + 1); f.rooms.sweep();
  }
  assert.notEqual(f.room.board.step, 'minigame');
  assert.equal(host.sparks, 3);
});

// ---------- Q2 ----------
test('Q2: removed words are gone and replacements keep the bank sizes', () => {
  const words = new Set(unscramble.map(x => x.word));
  for (const word of ['FLASHER', 'INSECT', 'BEAVER', 'BEAVERS']) assert.ok(!words.has(word), word);
  const drawings = new Set(sketch.map(x => x.word));
  for (const word of ['BEAVER', 'DOOR KNOCKER']) assert.ok(!drawings.has(word), word);
  assert.equal(unscramble.length, 350);
  assert.equal(sketch.length, 500);
});

test('Q2: scrambled letters never spell a rude word on the TV', () => {
  for (const word of ['INSECT', 'PISTACHE', 'SEXTANT', 'TITANIC', 'CARPETS']) {
    for (let i = 0; i < 400; i++) {
      const s = phase3.safeScramble(word, crypto.randomInt);
      assert.notEqual(s, word);
      assert.ok(!phase3.RUDE_FRAGMENTS.some(f => s.includes(f)), `${word} -> ${s}`);
    }
  }
  for (const {word} of unscramble) {
    const s = phase3.safeScramble(word, crypto.randomInt);
    assert.ok(!phase3.RUDE_FRAGMENTS.some(f => s.includes(f)), `${word} -> ${s}`);
  }
});
