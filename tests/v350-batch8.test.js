'use strict';
// NOGGIN v3.5.0 Batch 8 — board decisions and engagement: G1, G2, G6, G7, G8, G11, G12, Q9.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {GameRooms} = require('../server/rooms');
const board = require('../server/board');
const phase4 = require('../server/games/phase4');
const phase5 = require('../server/games/phase5');
const layout = require('../server/layout');

// Everyone Rolls (the default round style).
function show(count = 3, settings = {}) {
  let now = 1000;
  const rooms = new GameRooms({now: () => now, randomInt: () => 0});
  const {code} = rooms.create('tv');
  for (let i = 0; i < count; i++) {
    rooms.join({code, name: `P${i}`, avatarId: i + 1, socketId: `phone${i}`});
    rooms.setReady(code, `phone${i}`, true);
  }
  if (Object.keys(settings).length) rooms.setSettings(code, 'tv', settings);
  rooms.startGame(code, 'tv');
  const room = rooms.find(code);
  return {rooms, code, room, now: () => now, advance: ms => {now += ms; rooms.sweep();}};
}
function rollAll(f, dice) {
  const r = f.room.board.round; r.stage = 'rolling';
  f.room.players.forEach((p, i) => {r.rolls[p.id] = {dice: [dice[i]], die: dice[i], automatic: false};});
  f.room.board.deadline = f.now(); f.advance(1);
}
function moveAll(f) {for (let i = 0; i < f.room.players.length + 1; i++) f.advance(2601);}

// ---------- G1 ----------
test('G1: the caller picks 1 of 2 games from their category on their phone', () => {
  const f = show(3), [a, b, c] = f.room.players;
  a.position = 0; b.position = 0; c.position = 0;
  rollAll(f, [1, 2, 5]); moveAll(f); // A brain, B speed (caller), C applause
  f.advance(6001);
  const st = f.rooms.state(f.code, true).board;
  assert.equal(st.step, 'choose_game'); assert.equal(st.activeId, b.id);
  assert.equal(st.gameOptions.length, 2);
  assert.notEqual(st.gameOptions[0].id, st.gameOptions[1].id);
  for (const g of st.gameOptions) assert.equal(g.category, 'speed');
  assert.throws(() => f.rooms.chooseGame(f.code, 'phone0', {gameId: st.gameOptions[0].id}), e => e.code === 'TURN');
  assert.throws(() => f.rooms.chooseGame(f.code, 'phone1', {gameId: 'bomb-squad'}), e => e.code === 'GAME');
  f.rooms.chooseGame(f.code, 'phone1', {gameId: st.gameOptions[0].id});
  assert.equal(f.room.board.minigame.id, st.gameOptions[0].id);
  assert.equal(f.room.board.activeId, b.id);
});

test('G1: on timeout the studio picks one of the two; an offline caller is waited for, then defaulted', () => {
  const f = show(3), [a, b, c] = f.room.players;
  a.position = 0; b.position = 0; c.position = 0;
  rollAll(f, [1, 2, 5]); moveAll(f); f.advance(6001);
  const options = f.room.board.gameOptions.slice();
  f.advance(board.PICK_MS + 1);
  assert.ok(options.includes(f.room.board.minigame.id));

  const g = show(3), [x, y, z] = g.room.players;
  x.position = 0; y.position = 0; z.position = 0;
  rollAll(g, [1, 2, 5]); moveAll(g); g.advance(6001);
  const opts = g.room.board.gameOptions.slice();
  g.rooms.disconnect(g.code, 'phone1');
  g.advance(500);
  assert.equal(g.room.board.pauseKind, 'player', 'waits for the caller like any decision');
  g.advance(30_000);
  assert.equal(g.room.board.step, 'minigame');
  assert.ok(opts.includes(g.room.board.minigame.id));
});

test('G1: a Showdown lander picks their rival (leader on timeout) — covered with both paths', () => {
  const f = show(3), [a, b, c] = f.room.players;
  a.position = 5; b.position = 0; c.position = 0; c.sparks = 4;
  rollAll(f, [1, 2, 1]); moveAll(f); f.advance(6001);
  assert.equal(f.room.board.step, 'choose_opponent');
  assert.equal(f.room.board.deadline - f.now() <= board.PICK_MS + 1, true);
  f.rooms.chooseGame(f.code, 'phone0', {targetId: b.id});
  assert.deepEqual(f.room.board.showdown.participants, [a.id, b.id]);
});

// ---------- G2 ----------
function classicDuel(n = 5) {
  const f = show(n);
  f.room.board.landing = 10; // Tug of Wits
  phase5.start(f.room, 'corner', f.now(), f.room.players[1].id, () => 0);
  return f;
}
test('G2: Spotlight Picks are open in Classic and pay +1 Spark only outside the top two', () => {
  const f = classicDuel(5), ids = f.room.players.map(p => p.id);
  f.room.players[0].sparks = 3; f.room.players[2].sparks = 9; f.room.players[3].sparks = 1; f.room.players[4].sparks = 0; // top two: P2 and P0
  for (const p of f.room.players) p.cues = 0;
  assert.equal(f.rooms.state(f.code).board.showdown.cheerOpen, true);
  f.rooms.cheerGame(f.code, 'phone2', ids[0]); // leader: in the top two
  f.rooms.cheerGame(f.code, 'phone3', ids[0]); // outside the top two
  f.rooms.cheerGame(f.code, 'phone4', ids[1]); // backed the loser
  f.advance(5001);
  const m = f.room.board.showdown;
  for (let i = 0; i < 5; i++) {const q = m.sums[ids[0]]; f.rooms.inputGame(f.code, 'phone0', {answer: q.correct, qid: q.n}, m.roundKey);}
  assert.equal(f.room.board.step, 'result');
  assert.equal(f.room.players[2].sparks, 9, 'the leader gets nothing');
  assert.equal(f.room.players[3].sparks, 2, 'catch-up Spark');
  assert.equal(f.room.players[4].sparks, 0);
  assert.equal(f.room.players[3].cues, 0, 'no Director Cue in Classic');
  assert.match(f.room.board.result.text, /Spotlight Picks: P3 \+1 Spark/);
});

test('G2: Buzzer Battle is first to 3, at most 5 questions', () => {
  assert.equal(phase5.BUZZER_TARGET, 3);
  assert.equal(phase5.BUZZER_QUESTIONS, 5);
  const f = show(2);
  f.room.board.landing = 6;
  phase5.start(f.room, 'corner', f.now(), f.room.players[1].id, () => 0);
  f.advance(5001);
  const m = f.room.board.showdown;
  for (let i = 0; i < 20 && f.room.board.showdown === m; i++) f.advance(Math.max(1, m.deadline - f.now() + 1));
  assert.equal(m.used.length, 5);
});

// ---------- G6 ----------
function meld(n) {
  const f = show(n);
  f.room.board.activeId = f.room.players[0].id;
  phase4.start(f.room, 'together', f.now(), () => 0, 'mind-meld');
  f.advance(5001);
  return {f, m: f.room.board.minigame, play: (i, v) => f.rooms.inputGame(f.code, `phone${i}`, v, f.room.board.minigame.roundKey)};
}
test('G6: with 5 players, everyone plays — host pair, one pair, and the odd one out joins a three', () => {
  const {f, m, play} = meld(5), id = i => f.room.players[i].id;
  play(0, 1); // host picks P2
  assert.deepEqual(m.groups, [[id(0), id(2)], [id(1), id(3), id(4)]]);
  play(0, 'apple'); play(2, 'pear');
  play(1, 'moon'); play(3, 'star'); play(4, 'Moons'); // any two in the three
  assert.deepEqual(m.matched, [1]);
  f.advance(3100);
  play(0, 'tea'); play(2, 'tea');
  assert.equal(f.room.board.step, 'result');
  for (const i of [0, 1, 2, 3, 4]) assert.equal(f.room.players[i].sparks, 1, `P${i}`);
});

test('G6: with 3 players the spare player joins the host pair as a three', () => {
  const {f, m, play} = meld(3), id = i => f.room.players[i].id;
  play(0, 0);
  assert.deepEqual(m.groups, [[id(0), id(1), id(2)]]);
});

// ---------- G7 ----------
test('G7: Steal the Call replaces Swap Seats and makes the lander host', () => {
  assert.ok(!layout.SPACES.includes('swap'));
  assert.equal(layout.SPACES[13], 'steal');
  assert.equal(layout.LABELS.steal, 'Steal the Call');
  const data = require('../public/shared/board-data.json');
  assert.equal(data[13].type, 'steal');
  const f = show(3), [a, b, c] = f.room.players;
  a.position = 0; b.position = 12; c.position = 0;
  rollAll(f, [2, 1, 5]); // A calls speed (2), B steals (13), C applause
  moveAll(f);
  assert.equal(f.room.board.roundCategory, 'speed');
  assert.equal(f.room.board.roundCaller, b.id);
  assert.match(f.room.board.result.text, /STEALS THE CALL from P0/);
});

// ---------- G8 ----------
test('G8: the call moves live during movement, with a "steals the call" line', () => {
  const f = show(3), [a, b, c] = f.room.players;
  a.position = 0; b.position = 0; c.position = 0;
  rollAll(f, [1, 2, 5]); // A brain, B speed, C applause
  f.advance(2601);
  assert.equal(f.rooms.state(f.code).board.round.callerId, a.id);
  f.advance(2601);
  assert.equal(f.rooms.state(f.code).board.round.callerId, b.id);
  assert.equal(f.room.board.event.text, 'P1 steals the call from P0!');
});

// ---------- G11 ----------
test('G11: the first landing on a special space shows a 3 s explainer, once per match', () => {
  const f = show(2), [a, b] = f.room.players;
  a.position = 15; b.position = 15;
  rollAll(f, [1, 1]); // both land on Pickpocket (16)
  f.advance(2601);
  const x = f.room.board.explainer;
  assert.equal(x.type, 'pickpocket');
  assert.match(x.text, /^PICKPOCKET — steal 1 Spark from the leader$/);
  assert.equal(x.until, f.now() + board.EXPLAIN_MS);
  const first = x.until;
  f.advance(2601);
  assert.equal(f.room.board.explainer.until, first, 'not repeated for the second landing');
});

// ---------- G12 ----------
test('G12: a 4 s standings sting opens Last Orders, and rolling time starts after it', () => {
  const f = show(3);
  const b = f.room.board;
  b.roundNo = b.totalRounds - 1; b.stage = 'round-game';
  f.room.players[0].sparks = 5; f.room.players[2].sparks = 2;
  board.finishTurn(f.room, f.now(), 'Round over', []);
  f.advance(6001);
  assert.equal(b.roundNo, b.totalRounds);
  assert.equal(b.standings.until, f.now() + board.STANDINGS_MS);
  assert.deepEqual(b.standings.ranks.map(r => r.sparks), [5, 2, 0]);
  assert.equal(b.standings.line, 'Every Spark is doubled — last place can still win this!');
  assert.equal(b.deadline - f.now(), 12_000 + board.STANDINGS_MS);
});

// ---------- Q9 / clients ----------
test('Q9 and clients: gap line, CALL badge, explainer and standings are wired up', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const phone = read('public/play/play.js'), view = read('public/tv/board-view.js');
  assert.match(read('public/play/index.html'), /id="gapLine"/);
  assert.match(phone, /You're \$\{gap\} behind — /);
  assert.match(phone, /Last Orders doubles everything\./);
  assert.match(phone, /b\.roundNumber>b\.totalRounds-3/);
  assert.match(view, /call-badge/);
  assert.match(view, /showExplainer\(b,state\)/);
  assert.match(view, /showStandings\(b,state\)/);
  assert.match(read('public/tv/index.html'), /id="standingsSting"/);
});
