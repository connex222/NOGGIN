'use strict';
// NOGGIN v3.5.0 Batch 2 — connections and interruptions: D3, D4, D5, D13.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {GameRooms} = require('./helpers/sequential-rooms');
const {LOBBY_GRACE_MS} = require('../server/rooms');
const board = require('../server/board');
const phase3 = require('../server/games/phase3');
const phase4 = require('../server/games/phase4');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function lobby(players = 3) {
  let now = 80_000;
  const rooms = new GameRooms({now: () => now, randomInt: () => 0});
  const {code} = rooms.create('tv');
  const sockets = [];
  const joined = [];
  for (let i = 0; i < players; i++) {
    sockets.push('p' + i);
    joined.push(rooms.join({code, name: 'Player ' + i, avatarId: i + 1, socketId: 'p' + i}));
  }
  return {rooms, code, room: rooms.find(code), sockets, joined, now: () => now, step: ms => {now += ms; return rooms.sweep();}};
}
function inGame(players = 3) {
  const f = lobby(players);
  for (const s of f.sockets) f.rooms.setReady(f.code, s, true);
  f.rooms.startGame(f.code, 'tv');
  return f;
}
// Put the round game on a particular host, the way the board does.
function startRoundGame(f, hostIndex, module, category, id) {
  const b = f.room.board;
  b.stage = 'round-game'; b.activeId = f.room.players[hostIndex].id;
  module.start(f.room, category, f.now(), () => 0, id);
}

// ---------- D4 ----------
test('D4: a sleeping phone keeps its lobby seat for 10 minutes', () => {
  assert.equal(LOBBY_GRACE_MS, 10 * 60_000);
  const f = lobby(2);
  f.rooms.disconnect(f.code, 'p0');
  f.step(5 * 60_000);
  assert.equal(f.room.players.length, 2, 'still seated after 5 minutes');
  const back = f.rooms.resume({code: f.code, token: f.joined[0].token, role: 'player', socketId: 'p0-again'});
  assert.equal(back.playerId, f.joined[0].playerId);
  f.rooms.disconnect(f.code, 'p0-again');
  f.step(LOBBY_GRACE_MS + 1);
  assert.equal(f.room.players.length, 1, 'released after 10 minutes');
});

test('D4: an offline but ready player does not block START, and rejoins their seat', () => {
  const f = lobby(3);
  for (const s of f.sockets) f.rooms.setReady(f.code, s, true);
  f.rooms.disconnect(f.code, 'p2');
  assert.equal(f.rooms.state(f.code).canStart, true);
  f.rooms.startGame(f.code, 'tv');
  assert.equal(f.room.phase, 'board');
  const back = f.rooms.resume({code: f.code, token: f.joined[2].token, role: 'player', socketId: 'p2-back'});
  assert.equal(back.playerId, f.joined[2].playerId);
});

test('D4: a player who is not ready still blocks START', () => {
  const f = lobby(2);
  f.rooms.setReady(f.code, 'p0', true);
  assert.equal(f.rooms.state(f.code).canStart, false);
});

// ---------- D5 ----------
test('D5: a game that does not need its host carries on when the host phone drops', () => {
  for (const [module, category, id] of [[phase3, 'speed', 'quick-draw'], [phase3, 'brain', 'close-call'], [phase4, 'create', 'caption-this'], [phase4, 'together', 'relay-sums']]) {
    const f = inGame(3);
    startRoundGame(f, 0, module, category, id);
    f.rooms.disconnect(f.code, 'p0');
    f.step(500);
    assert.ok(!Number.isFinite(f.room.board.pausedAt), `${id} must not pause`);
    assert.equal(f.room.board.minigame.id, id);
    assert.throws(() => f.rooms.skipDisconnectedGame(f.code, 'tv'), e => e.code === 'ONLINE', id);
    // Run the clock out: the game finishes normally instead of being cancelled.
    for (let guard = 0; guard < 40 && f.room.board.step === 'minigame'; guard++) {
      f.step(Math.max(1, (f.room.board.minigame?.deadline || f.now()) - f.now() + 1));
    }
    assert.equal(f.room.board.step, 'result', id);
    assert.doesNotMatch(f.room.board.result.text, /cancelled/, id);
  }
});

test('D5: a host-critical game waits 30 s, then hands hosting to the next online player by seat', () => {
  const f = inGame(4);
  startRoundGame(f, 1, phase4, 'create', 'sketch-sabotage');
  f.rooms.disconnect(f.code, 'p1');
  f.rooms.disconnect(f.code, 'p2'); // the next seat is offline too, so it should skip to seat 4
  f.step(500);
  assert.ok(Number.isFinite(f.room.board.pausedAt), 'waits for the host first');
  f.step(30_000);
  const b = f.room.board;
  assert.equal(b.step, 'minigame');
  assert.equal(b.minigame.id, 'sketch-sabotage');
  assert.equal(b.activeId, f.room.players[3].id);
  assert.equal(b.minigame.host, f.room.players[3].id);
  assert.equal(b.minigame.phase, 'intro', 'the game restarts from its rules card');
  assert.match(b.event.text, /now hosts Sketch & Sabotage/);
  assert.ok(!Number.isFinite(b.pausedAt));
});

test('D5: TV SKIP on a host-critical game also hands over rather than cancelling', () => {
  const f = inGame(3);
  startRoundGame(f, 0, phase4, 'together', 'bomb-squad');
  f.rooms.disconnect(f.code, 'p0');
  f.step(500);
  f.rooms.skipDisconnectedGame(f.code, 'tv');
  assert.equal(f.room.board.minigame.id, 'bomb-squad');
  assert.equal(f.room.board.activeId, f.room.players[1].id);
});

test('D5: with nobody left online, a host-critical game is cancelled as before', () => {
  const f = inGame(2);
  startRoundGame(f, 0, phase4, 'create', 'noise-annoys');
  f.rooms.disconnect(f.code, 'p0'); f.rooms.disconnect(f.code, 'p1');
  f.step(500); f.step(30_000);
  assert.equal(f.room.board.step, 'result');
  assert.match(f.room.board.result.text, /cancelled/);
});

test('D5: board-phase turns still pause and skip exactly as before', () => {
  const f = inGame(2);
  f.rooms.disconnect(f.code, f.sockets[f.room.players.findIndex(p => p.id === f.room.board.activeId)]);
  f.step(500);
  assert.equal(f.room.board.pauseKind, 'player');
  assert.equal(f.rooms.state(f.code).board.pauseKind, 'player');
  f.step(30_000);
  assert.equal(f.room.board.step, 'result');
  assert.match(f.room.board.result.text, /skipped/);
});

test('D5: the host-critical list is exactly the four games in the brief', () => {
  assert.deepEqual([...board.HOST_CRITICAL].sort(), ['bomb-squad', 'mind-meld', 'noise-annoys', 'sketch-sabotage']);
});

// ---------- D3 ----------
test('D3: TV explains a lost game, phones explain the reset, and the TV keeps the server awake', () => {
  const tv = read('public/tv/tv.js'), html = read('public/tv/index.html'), phone = read('public/play/play.js');
  assert.match(html, /id="restartBanner"/);
  assert.match(tv, /The game server restarted — the previous game was lost\. New room code: /);
  assert.match(tv, /Players: scan the new QR\./);
  assert.match(tv, /fetch\('\/health'/);
  assert.match(tv, /4 \* 60_000/);
  assert.match(phone, /The game was reset on the TV — scan the new QR code/);
  assert.match(phone, /your seat is held for 10 minutes/i);
  assert.match(phone, /navigator\.wakeLock\.request\('screen'\)/);
  assert.match(phone, /visibilitychange/);
});

test('D3: the game-night checklist covers every point in the brief', () => {
  const list = read('GAME-NIGHT-CHECKLIST.md');
  for (const needle of [/Don't change anything on game day/, /5 minutes before/, /Enable sound/, /keep the NOGGIN page open/, /battery saver/, /server restarted/, /start-noggin\.bat/, /same Wi-Fi/, /MATCH REPORT/]) {
    assert.match(list, needle);
  }
});

// ---------- D13 ----------
test('D13: blocked localStorage never throws from the shared client helpers or TV sound', () => {
  const broken = {getItem() {throw new Error('blocked');}, setItem() {throw new Error('blocked');}, removeItem() {throw new Error('blocked');}};
  const context = {window: {}, localStorage: broken, document: {}, Number, Math, String, JSON, Error, Set, Promise, fetch: async () => ({ok: false})};
  vm.createContext(context);
  vm.runInContext(read('public/shared/client.js'), context);
  const U = context.window.Noggin;
  assert.equal(U.readSession('x'), null);
  assert.equal(U.saveSession('x', {a: 1}), false);
  assert.doesNotThrow(() => U.clearSession('x'));
  assert.equal(U.storageGet('x'), null);
  assert.equal(U.storageSet('x', 1), false);
  vm.runInContext(read('public/tv/sound.js') + '\nthis.__Sound = NogginSound;', context);
  const sound = new context.__Sound();
  assert.doesNotThrow(() => {sound.setVolume(0.4); sound.setMuted(true); sound.setMusicVolume(0.2); sound.setMusicMuted(true);});
  for (const file of ['public/tv/tv.js', 'public/play/play.js', 'public/tv/sound.js']) {
    const raw = read(file).replace(/try\{[^}]*localStorage[^}]*\}/g, '');
    assert.doesNotMatch(raw, /localStorage\.(get|set|remove)Item/, `${file} has an unguarded localStorage call`);
  }
});
