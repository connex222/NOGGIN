'use strict';
// NOGGIN v3 board engine. Server-owned rounds, dice, spaces and scoring.
//
// EVERY ROUND (both round styles)
//   1. Board phase: every contestant moves once. Landings are quick, personal
//      events. Category spaces CALL the round's game and make the caller its
//      host; a later colour steals the call. A Wildcard picks, locks and hosts.
//      One corner Showdown per round; later corner landings pay a Corner Bonus.
//   2. Round game: one all-player mini-game, hosted by the caller.
//   3. After the final round ("Last Orders": Spark gains doubled) the most
//      Sparks wins. A tie for first goes to the Noggin-Off.
//
// ROUND STYLES
//   everyone   (default) — all phones roll at once on a shared countdown, the TV
//              moves tokens one at a time, landings resolve automatically.
//   sequential — "One at a time": each contestant rolls and resolves in turn,
//              choosing swap targets and Showdown rivals themselves.
const crypto = require('node:crypto');
const layout = require('./layout');
const {SPACES, COLORS, ICONS, LABELS, LIFTS, SHOWDOWNS, CATEGORIES} = layout;
// 'auto' sizes the show to the panel: small groups get more rounds so the
// evening is not over in ten minutes; big groups get fewer so it is not three hours.
const ROUND_OPTIONS = Object.freeze(['auto', 6, 8, 10, 12]);
const DEFAULT_ROUNDS = 'auto';
// Everyone Rolls is quicker per round, so Auto gives it more rounds for the same evening.
function autoRounds(playerCount, style = 'everyone') {
  if (style === 'everyone') return playerCount <= 5 ? 12 : 10;
  return playerCount <= 3 ? 12 : playerCount <= 5 ? 10 : 8;
}
const DIRECTORS_CUES = 2;
const DIRECTORS_CHOICE_MS = 6000;
const DECISION_MS = 12000;
const ROUND_ROLL_MS = 12000;
// Presentation timing. The TV tumbles the die for 1.24 s and hops a token every
// 150 ms. The server waits for that before it starts any clock or advances, so
// no result, question or countdown appears while the dice are still in the air.
const DICE_SHOW_MS = 1300;
const HOP_MS = 150;
const SETTLE_MS = 400;
function presentMs(steps) {return DICE_SHOW_MS + HOP_MS * Math.max(0, steps) + SETTLE_MS;}
const ROUND_MOVE_MS = presentMs(0); // used before the first token moves
const START_LAND_BONUS = 2;
const START_PASS_BONUS = 1;
const APPLAUSE_BONUS = 2;
const ROUND_GAME_BONUS = 1;
const CORNER_BONUS = 1;
const UNDERDOG_THRESHOLD = 3;
const UNDERDOG_BONUS_SMALL = 1;
const UNDERDOG_BONUS_EIGHT = 2;
// Values used when the server makes a Director's Cut nudge on a player's behalf.
const SPACE_VALUE = {applause: 6, start: 6, showdown: 5, wildcard: 4, pickpocket: 4, speed: 3, brain: 3, create: 3, together: 3, swap: 2, lift: 1, drain: -6};
const QUESTIONS = require('../data/demo-questions.json');
const phase3 = require('./games/phase3');
const phase4 = require('./games/phase4');
const phase5 = require('./games/phase5');

function fail(code, message) {const e = new Error(message); e.code = code; throw e;}
function requireStep(b, step) {if (b.step !== step) fail('STEP', 'That action is not available right now.');}
function actor(room) {return room.players.find(p => p.id === room.board.activeId);}
function random(n, randomInt = crypto.randomInt) {return randomInt(n);}
function showtime(room) {return room.settings.rules === 'showtime';}
function everyone(room) {return room.settings.roundStyle === 'everyone';}
function nameOf(room, id) {return room.players.find(p => p.id === id)?.name || 'Contestant';}
function plural(n, word) {return `${n} ${word}${n === 1 ? '' : 's'}`;}
function presentationLeft(b, now) {return Math.max(0, (b.presentUntil || 0) - now);}
function snapshot(room) {return Object.fromEntries(room.players.map(p => [p.id, p.sparks]));}
function lastOrders(b) {return b.roundNo >= b.totalRounds;}
function seats(room) {return [...room.players].sort((a, z) => a.seat - z.seat);}
function leaderExcept(room, id) {return room.players.filter(x => x.id !== id).sort((a, z) => z.sparks - a.sparks || a.seat - z.seat)[0];}
function boardTurnPlayer(room) {
  const b = room.board, n = room.players.length;
  return room.players[(b.roundNo - 1 + b.turnInRound) % n];
}

function publicBoard(room, forTv = false, viewerId = null) {
  const b = room.board;
  if (!b) return null;
  const r = b.round;
  const challenge = b.challenge ? {kind: b.challenge.kind, title: b.challenge.title, question: b.challenge.question, choices: b.challenge.choices, participants: b.challenge.participants, answered: Object.keys(b.challenge.answers), deadline: b.challenge.deadline} : null;
  return {
    round: r ? {number: r.number, stage: r.stage, rolls: r.rolls, directors: r.directors, spotlightId: r.spotlightId, moveIndex: r.moveIndex, prioritySeat: r.prioritySeat} : null,
    roundNumber: b.roundNo, totalRounds: b.totalRounds, stage: b.stage, lastOrders: lastOrders(b), turnInRound: b.turnInRound,
    roundGame: {category: b.roundCategory, callerId: b.roundCaller, locked: b.roundLocked}, showdownPlayed: Boolean(b.showdownPlayed),
    routePlan: showtime(room) && Boolean(b.routePlan), routeOptions: b.step === 'choose_route' ? (b.routeOptions || []) : [],
    showdown: phase5.publicState(room, forTv, viewerId),
    minigame: (b.minigame && phase4.SPECS[b.minigame.id] ? phase4.publicState(room, forTv, viewerId) : phase3.publicState(room, forTv)),
    step: b.step, turn: b.turn, activeId: b.activeId, rolls: b.rolls, landing: b.landing, lastMove: b.lastMove, event: b.event,
    deadline: b.deadline, nextAt: b.nextAt, presentUntil: b.presentUntil || null, challenge, result: b.result, leaderIds: b.leaderIds, finalists: b.finalists,
    winnerIds: b.winnerIds, history: b.history.slice(-8), paused: Boolean(b.pausedAt), pauseReason: b.pauseReason
  };
}

function start(room, now = Date.now()) {
  if (room.phase !== 'lobby') fail('PHASE', 'Game already started.');
  if (!room.hostSocketId || room.players.length < 2 || !room.players.every(p => p.ready && p.socketId)) fail('READY', 'Two to eight connected, ready players required.');
  for (const p of room.players) {p.sparks = 0; p.position = 0; p.cues = showtime(room) ? DIRECTORS_CUES : 0;}
  const chosen = room.settings.rounds;
  const totalRounds = Number.isInteger(chosen) && ROUND_OPTIONS.includes(chosen) ? chosen : autoRounds(room.players.length, everyone(room) ? 'everyone' : 'sequential');
  room.phase = 'board';
  room.board = {
    roundNo: 1, totalRounds, stage: 'board', turnInRound: 0, roundCategory: null, roundCaller: null, roundLocked: false, showdownPlayed: false, round: null,
    step: 'await_roll', turn: 1, activeId: room.players[0].id, rolls: [], landing: 0, lastMove: null,
    event: {type: 'intro', text: `Welcome to the NOGGIN stage! ${totalRounds} rounds. Land on a coloured space to call the round's game.`},
    deadline: null, nextAt: null, challenge: null, result: null, leaderIds: [], finalists: [], winnerIds: [], history: [],
    pausedAt: null, pauseReason: null, showdown: null, tieQuestions: [], seenQuestions: [], seenGames: [], lastGame: null,
    minigame: null, moveRevision: 0, routePlan: false, routeOptions: [], turnStartSparks: snapshot(room)
  };
  if (everyone(room)) beginRound(room, now);
}

// ───────────────────────── Everyone Rolls ─────────────────────────
// The server creates every die, including timeout rolls; clients never send values.
function beginRound(room, now) {
  const b = room.board, order = seats(room), number = b.roundNo;
  const spotlight = order[(number - 1) % order.length];
  b.round = {number, stage: 'rolling', rolls: {}, moves: [], moveIndex: 0, spotlightId: spotlight.id, prioritySeat: spotlight.seat,
    directors: {}, showdownId: null, wildcardId: null, showdownPending: false, wildcardPending: false};
  b.stage = 'board'; b.turn = number; b.activeId = spotlight.id; b.step = 'round_roll'; b.rolls = [];
  b.deadline = now + ROUND_ROLL_MS; b.nextAt = null; b.result = null; b.lastMove = b.lastMove || null;
  b.event = {type: 'round', text: lastOrders(b) ? `LAST ORDERS! Final round — every Spark you win is doubled. Everyone roll now!` : `Round ${number} of ${b.totalRounds}: everyone roll now!`};
  b.turnStartSparks = snapshot(room);
}
function catchUpDice(room, p, rng) {
  const lowest = Math.min(...room.players.map(x => x.sparks));
  const catchUp = showtime(room) && p.sparks === lowest && room.players.some(x => x.sparks > lowest);
  return Array.from({length: catchUp ? 2 : 1}, () => 1 + random(6, rng));
}
function roundRoll(room, id, now, rng = crypto.randomInt) {
  const b = room.board, r = b.round; if (!everyone(room) || !r || r.stage !== 'rolling') fail('STEP', 'Not time to roll.');
  if (!room.players.some(p => p.id === id)) fail('PLAYER', 'Not in this room.');
  if (Object.hasOwn(r.rolls, id)) fail('ROLLED', 'Your roll is already locked in.');
  const p = room.players.find(x => x.id === id), dice = catchUpDice(room, p, rng);
  // On a shared countdown, the server takes the better catch-up die automatically.
  let die = Math.max(...dice);
  if (r.directors[id] && p.cues > 0) {
    const options = [die, Math.max(1, die - 1), Math.min(6, die + 1)].filter((x, i, a) => a.indexOf(x) === i);
    const value = steps => SPACE_VALUE[SPACES[(p.position + steps) % SPACES.length]] || 0;
    const choice = options.sort((a, z) => value(z) - value(a))[0];
    if (choice !== die) {die = choice; p.cues--;}
  }
  r.rolls[id] = {dice, die, automatic: false};
  if (room.players.every(x => Object.hasOwn(r.rolls, x.id))) prepareRoundMoves(room, now, rng);
}
function prepareRoundMoves(room, now, rng = crypto.randomInt) {
  const b = room.board, r = b.round; if (r.stage !== 'rolling') return;
  for (const p of room.players) if (!Object.hasOwn(r.rolls, p.id)) {const dice = catchUpDice(room, p, rng); r.rolls[p.id] = {dice, die: Math.max(...dice), automatic: true};}
  // Movement (and therefore who calls the game last) starts from the rotating priority seat.
  const order = seats(room), first = order.findIndex(p => p.seat === r.prioritySeat);
  r.moves = [...order.slice(first), ...order.slice(0, first)].map(p => ({id: p.id, die: r.rolls[p.id].die}));
  r.stage = 'moving'; r.moveIndex = 0; b.step = 'round_moving'; b.deadline = null; b.nextAt = now + ROUND_MOVE_MS;
  b.event = {type: 'round', text: 'Dice locked! Watch everyone move.'};
}
function advanceRoundMove(room, now, rng) {
  const b = room.board, r = b.round, entry = r.moves[r.moveIndex];
  if (!entry) {resolveRoundLandings(room, now, rng); return;}
  const p = room.players.find(x => x.id === entry.id), from = p.position, path = [];
  for (let k = 1; k <= entry.die; k++) path.push((from + k) % SPACES.length);
  p.position = path.at(-1); const to = p.position;
  if (path.includes(0) && to !== 0) p.sparks += START_PASS_BONUS;
  if (path.includes(0) && showtime(room)) p.cues = Math.min(DIRECTORS_CUES, (p.cues || 0) + 1);
  b.activeId = p.id; b.landing = to;
  b.lastMove = {playerId: p.id, from, to, path, die: entry.die, revision: ++b.moveRevision};
  b.event = {type: 'move', text: `Moving: ${p.name} (${entry.die})`};
  r.moveIndex++; b.nextAt = now + presentMs(entry.die);
}
function resolveRoundLandings(room, now) {
  const b = room.board, r = b.round, lines = [];
  // Resolve in movement order, starting from the rotating priority seat.
  const order = seats(room), first = Math.max(0, order.findIndex(p => p.seat === r.prioritySeat));
  for (const {id} of [...order.slice(first), ...order.slice(0, first)]) {
    const p = room.players.find(x => x.id === id); if (!p) continue;
    const type = SPACES[p.position];
    if (type === 'start') {p.sparks += START_LAND_BONUS; lines.push(`${p.name} START +${START_LAND_BONUS}`);}
    else if (type === 'applause') {p.sparks += APPLAUSE_BONUS; lines.push(`${p.name} APPLAUSE +${APPLAUSE_BONUS}`);}
    else if (type === 'lift') {p.position = LIFTS[p.position]; lines.push(`${p.name} took the Stage Lift`);}
    else if (type === 'drain') {p.sparks = Math.max(0, p.sparks - 1); lines.push(`${p.name} was drained −1`);}
    else if (type === 'pickpocket') {const v = leaderExcept(room, p.id); if (v?.sparks > 0) {v.sparks--; p.sparks++; lines.push(`${p.name} pickpocketed ${v.name}`);} else lines.push(`${p.name} found nothing to pickpocket`);}
    else if (type === 'swap') {const other = leaderExcept(room, p.id); if (other) {[p.position, other.position] = [other.position, p.position]; lines.push(`${p.name} swapped places with ${other.name}`);}}
    else if (type === 'showdown') {
      if (!r.showdownId) {r.showdownId = p.id; r.showdownSpace = p.position; r.showdownPending = true; b.showdownPlayed = true; lines.push(`${p.name} takes the ${SHOWDOWNS[p.position]} corner`);}
      else {p.sparks += CORNER_BONUS; lines.push(`${p.name} Corner Bonus +${CORNER_BONUS}`);}
    }
    else if (type === 'wildcard') {
      if (!r.wildcardId && !b.roundLocked) {r.wildcardId = p.id; r.wildcardPending = true; lines.push(`${p.name} holds the WILDCARD`);}
    }
    else if (CATEGORIES.includes(type) && !b.roundLocked) {b.roundCategory = type; b.roundCaller = p.id; lines.push(`${p.name} calls ${LABELS[type].toUpperCase()}`);}
  }
  r.stage = 'landed';
  const pick = b.roundCategory ? ` · Round game: ${LABELS[b.roundCategory].toUpperCase()}, hosted by ${nameOf(room, b.roundCaller)}` : '';
  b.activeId = r.spotlightId; b.step = 'round_landings';
  finishTurn(room, now, `${lines.length ? lines.join(' · ') : 'Everyone landed quietly'}${r.wildcardPending ? '' : pick}.`);
}
// After the landing verdict: Wildcard choice, then the Showdown, then the round game.
function continueRound(room, now, rng) {
  const b = room.board, r = b.round;
  if (r.wildcardPending) {
    r.wildcardPending = false; b.activeId = r.wildcardId; resetTurnFlags(room); b.step = 'choose_category'; b.deadline = now + DECISION_MS;
    b.event = {type: 'wildcard', text: `WILDCARD! ${nameOf(room, r.wildcardId)} picks this round's game, locks it in and hosts it.`}; return;
  }
  if (r.showdownPending) {
    r.showdownPending = false; r.stage = 'showdown';
    const p = room.players.find(x => x.id === r.showdownId), rival = leaderExcept(room, p.id);
    // The corner is remembered at landing time: a later Swap may have moved this player since.
    b.activeId = p.id; b.landing = r.showdownSpace; resetTurnFlags(room);
    phase5.start(room, 'corner', now, rival.id, rng); return;
  }
  startRoundGame(room, now, rng);
}
function tickRound(room, now, rng) {
  const b = room.board, r = b.round;
  if (r.stage === 'rolling' && now >= b.deadline) {prepareRoundMoves(room, now, rng); return true;}
  if (r.stage === 'moving' && now >= b.nextAt) {advanceRoundMove(room, now, rng); return true;}
  return false;
}

// ───────────────────────── One at a time ─────────────────────────
function currentIs(room, id) {if (room.board.activeId !== id) fail('TURN', 'It is not your turn.');}
function beginMove(room, die, now, rng = crypto.randomInt) {
  const b = room.board, p = actor(room), from = p.position, path = [];
  for (let k = 1; k <= die; k++) path.push((from + k) % SPACES.length);
  const to = path.at(-1);
  p.position = to; b.landing = to; b.lastMove = {playerId: p.id, from, to, path, die, revision: ++b.moveRevision}; b.rolls = [];
  b.presentUntil = now + presentMs(path.length);
  const passed = path.includes(0) && to !== 0;
  if (passed) p.sparks += START_PASS_BONUS;
  if (path.includes(0) && showtime(room)) p.cues = Math.min(DIRECTORS_CUES, (p.cues || 0) + 1);
  resolveLanding(room, now, passed, rng);
}
function roll(room, id, now, randomInt) {
  const b = room.board;
  if (everyone(room)) {roundRoll(room, id, now, randomInt); return;}
  requireStep(b, 'await_roll'); currentIs(room, id);
  const low = Math.min(...room.players.map(p => p.sparks));
  const diceCount = showtime(room) && actor(room).sparks === low && room.players.some(p => p.sparks > low) ? 2 : 1;
  b.rolls = Array.from({length: diceCount}, () => 1 + random(6, randomInt));
  if (showtime(room) && b.routePlan) {
    const p = actor(room), options = [];
    for (let i = 0; i < b.rolls.length; i++) for (const offset of [0, -1, 1]) {
      const steps = b.rolls[i] + offset;
      if (steps < 1 || steps > 6 || (offset !== 0 && p.cues < 1)) continue;
      const landing = (p.position + steps) % SPACES.length;
      if (!options.some(o => o.steps === steps)) options.push({dieIndex: i, offset, steps, landing, type: SPACES[landing], cost: offset === 0 ? 0 : 1});
    }
    b.routeOptions = options; b.step = 'choose_route'; b.deadline = now + DIRECTORS_CHOICE_MS;
    b.event = {type: 'directors-cut', text: `${p.name} calls DIRECTOR'S CUT! Choose a landing. Nudging one space costs a Cue.`}; return;
  }
  if (diceCount === 2) {b.step = 'choose_die'; b.deadline = now + DECISION_MS; b.event = {type: 'dice', text: 'Catch-up roll: choose either die.'}; return;}
  beginMove(room, b.rolls[0], now, randomInt);
}
function pickDie(room, id, index, now, rng = crypto.randomInt) {
  const b = room.board; requireStep(b, 'choose_die'); currentIs(room, id);
  if (index !== 0 && index !== 1) fail('DIE', 'Choose die 1 or die 2.');
  beginMove(room, b.rolls[index], now, rng);
}
function sampleQuestion(b, randomInt) {
  const pool = QUESTIONS.filter(q => !b.seenQuestions.includes(q.id));
  const options = pool.length ? pool : QUESTIONS;
  const chosen = options[random(options.length, randomInt)];
  b.seenQuestions.push(chosen.id); if (b.seenQuestions.length >= QUESTIONS.length) b.seenQuestions = [];
  return chosen;
}
function beginChallenge(room, kind, now, randomInt = crypto.randomInt) {
  const b = room.board, q = sampleQuestion(b, randomInt);
  const participants = kind === 'tiebreak' ? b.finalists.slice() : [b.activeId];
  const ms = (kind === 'drain' ? 5_000 : (room.settings.timerSpeed === 'relaxed' ? 24_000 : 16_000)) + presentationLeft(b, now);
  b.challenge = {kind, title: kind === 'drain' ? 'BRAIN DRAIN' : 'NOGGIN-OFF TIEBREAKER', question: q.prompt, choices: q.options, correct: q.correct, participants, answers: {}, deadline: now + ms};
  b.step = 'challenge'; b.deadline = b.challenge.deadline;
  b.event = {type: 'challenge', text: kind === 'drain' ? `${actor(room).name} hit BRAIN DRAIN! Answer in five seconds or lose one Spark.` : 'Closest to the tie-break target wins.'};
}
function callGame(room, p, category, locked) {
  const b = room.board;
  b.roundCategory = category; b.roundCaller = p.id; b.roundLocked = Boolean(locked);
}
function resolveLanding(room, now, passed, rng = crypto.randomInt) {
  const b = room.board, p = actor(room), type = SPACES[p.position]; b.result = null; b.deadline = null;
  const pass = passed ? ` (+${START_PASS_BONUS} for passing START)` : '';
  if (type === 'start') {p.sparks += START_LAND_BONUS; finishTurn(room, now, `${p.name} landed on START: +${START_LAND_BONUS} Sparks!`); return;}
  if (type === 'applause') {p.sparks += APPLAUSE_BONUS; finishTurn(room, now, `APPLAUSE! The studio loves ${p.name}: +${APPLAUSE_BONUS} Sparks${pass}.`); return;}
  if (type === 'lift') {const was = p.position; p.position = LIFTS[was]; finishTurn(room, now, `${p.name} rode the Stage Lift ${LIFTS[was] > was ? 'forward' : 'back'} to space ${p.position + 1}${pass}.`); return;}
  if (type === 'pickpocket') {
    const victim = leaderExcept(room, p.id);
    if (victim?.sparks > 0) {victim.sparks--; p.sparks++; finishTurn(room, now, `PICKPOCKET! ${p.name} stole a Spark from the leader, ${victim.name}${pass}.`);}
    else finishTurn(room, now, `PICKPOCKET! …but nobody has a Spark to steal${pass}.`);
    return;
  }
  if (CATEGORIES.includes(type)) {
    const label = LABELS[type].toUpperCase();
    if (b.roundLocked) {finishTurn(room, now, `${p.name} landed on ${label}, but the Wildcard has locked this round's game: ${LABELS[b.roundCategory].toUpperCase()}${pass}.`); return;}
    const stolen = b.roundCaller && b.roundCaller !== p.id ? ` (taking the spotlight from ${nameOf(room, b.roundCaller)})` : '';
    callGame(room, p, type, false);
    finishTurn(room, now, `${p.name} called a ${label} game for this round and will host it${stolen}${pass}.`); return;
  }
  if (type === 'swap') {b.step = 'choose_target'; b.deadline = now + presentationLeft(b, now) + DECISION_MS; b.event = {type: 'swap', text: `${p.name}: choose a player to swap board positions with.`}; return;}
  if (type === 'wildcard') {b.step = 'choose_category'; b.deadline = now + presentationLeft(b, now) + DECISION_MS; b.event = {type: 'wildcard', text: `WILDCARD! ${p.name} picks this round's game, locks it in and hosts it.`}; return;}
  // One Showdown per round keeps the spotlight shared.
  if (type === 'showdown' && b.showdownPlayed) {p.sparks += CORNER_BONUS; finishTurn(room, now, `${SHOWDOWNS[p.position]} corner — this round's Showdown has already been played, so ${p.name} takes a +${CORNER_BONUS} Corner Bonus${pass}.`); return;}
  if (type === 'showdown') {b.showdownPlayed = true; b.step = 'choose_opponent'; b.deadline = now + presentationLeft(b, now) + DECISION_MS; b.event = {type: 'showdown', text: `${SHOWDOWNS[p.position]} corner! ${p.name} challenges a rival — winner takes up to 2 Sparks.`}; return;}
  if (type === 'drain') {beginChallenge(room, 'drain', now, rng); return;}
  finishTurn(room, now, `${p.name} landed safely.`);
}

// ───────────────────────── Shared ─────────────────────────
function choose(room, id, payload, now, randomInt) {
  const b = room.board;
  if (everyone(room) && b.step === 'round_roll') {
    const r = b.round, p = room.players.find(x => x.id === id);
    if (!p) fail('PLAYER', 'Not seated.');
    if (Object.hasOwn(r.rolls, id)) fail('ROLLED', 'Your roll is already locked in.');
    if (!['director', 'normal'].includes(payload?.action)) fail('STEP', 'Unsupported shared-round action.');
    if (!showtime(room)) fail('RULES', 'Showtime features are disabled in Classic.');
    if (payload.action === 'director') {if (!p.cues) fail('CUES', 'No Director Cues left.'); r.directors[id] = true;}
    else delete r.directors[id];
    return;
  }
  currentIs(room, id);
  if (!showtime(room) && b.step === 'await_roll' && ['director', 'normal'].includes(payload?.action)) fail('RULES', 'Extra options are disabled in Classic.');
  if (b.step === 'await_roll' && ['director', 'normal'].includes(payload?.action)) {
    if (payload.action === 'director' && !(actor(room).cues > 0)) fail('CUES', 'No Director Cues left.');
    b.routePlan = payload.action === 'director';
    b.event = {type: 'directors-cut', text: b.routePlan ? `${actor(room).name} is planning a Director's Cut — roll, then choose the landing.` : `${actor(room).name} will take the normal roll.`}; return;
  }
  if (b.step === 'choose_route') {
    if (!Number.isInteger(payload?.option) || !b.routeOptions[payload.option]) fail('ROUTE', 'Choose one of the displayed landings.');
    const option = b.routeOptions[payload.option], p = actor(room);
    if (option.cost > p.cues) fail('CUES', 'Not enough Director Cues.');
    p.cues -= option.cost; b.routeOptions = []; b.routePlan = false;
    beginMove(room, option.steps, now, randomInt); return;
  }
  if (b.step === 'choose_target' || b.step === 'choose_opponent') {
    const target = room.players.find(p => p.id === payload?.targetId && p.id !== id);
    if (!target) fail('TARGET', 'Choose another contestant.');
    if (b.step === 'choose_target') {const p = actor(room); [p.position, target.position] = [target.position, p.position]; finishTurn(room, now, `${p.name} swapped places with ${target.name}!`);}
    else phase5.start(room, 'corner', now, target.id, randomInt);
    return;
  }
  if (b.step === 'choose_category') {
    if (!CATEGORIES.includes(payload?.category)) fail('CATEGORY', 'Choose Speed, Brain, Create or Together.');
    const p = actor(room); callGame(room, p, payload.category, true);
    finishTurn(room, now, `WILDCARD: ${p.name} locked in a ${LABELS[payload.category].toUpperCase()} game for this round and will host it.`); return;
  }
  fail('STEP', 'Nothing to choose right now.');
}
function answer(room, id, choice, now) {
  const b = room.board; requireStep(b, 'challenge'); const c = b.challenge;
  if (!c.participants.includes(id)) fail('PLAYER', 'You are not part of this challenge.');
  if (Object.hasOwn(c.answers, id)) fail('ANSWERED', 'You already submitted an answer.');
  if (!Number.isInteger(choice) || choice < 0 || choice >= c.choices.length) fail('ANSWER', 'Select one of the displayed answers.');
  if (now > c.deadline) fail('LATE', 'Time is up.');
  c.answers[id] = {choice, at: now, correct: choice === c.correct};
  if (c.participants.every(pid => Object.hasOwn(c.answers, pid))) resolveChallenge(room, now);
}
function resolveChallenge(room, now) {
  const b = room.board, c = b.challenge;
  if (!c || b.step !== 'challenge') return;
  if (c.kind === 'tiebreak') {
    const scored = Object.entries(c.answers).map(([id, a]) => ({id, distance: Math.abs(Number(c.choices[a.choice]) - Number(c.choices[c.correct]))}));
    const best = Math.min(...scored.map(x => x.distance));
    const winners = scored.filter(x => x.distance === best).map(x => x.id);
    if (winners.length === 1) {
      const text = `${nameOf(room, winners[0])} wins NOGGIN!`;
      b.winnerIds = winners; b.step = 'finished'; room.phase = 'finished'; b.challenge = null; b.deadline = null;
      b.result = {text, winners}; b.event = {type: 'finished', text}; return;
    }
    b.finalists = winners.length ? winners : c.participants; b.challenge = null;
    beginChallenge(room, 'tiebreak', now); b.result = {text: 'Still tied! Another Close Call!', winners: []}; return;
  }
  // Brain Drain is a penalty dodge, not a contest: surviving earns nothing extra.
  const p = actor(room), survived = Boolean(c.answers[p.id]?.correct);
  if (!survived) p.sparks = Math.max(0, p.sparks - 1);
  b.challenge = null;
  finishTurn(room, now, survived ? `${p.name} survived Brain Drain!` : `${p.name} was drained: −1 Spark.`);
}

function finishTurn(room, now, text, winners = []) {
  const b = room.board;
  const won = [...new Set(winners)].filter(id => room.players.some(p => p.id === id));
  // The round game is the main event: every winner earns a bonus Spark on top
  // of the mini-game's own award (+1 each, +2 for the host).
  if (b.stage === 'round-game' && won.length) {
    for (const id of won) room.players.find(p => p.id === id).sparks += ROUND_GAME_BONUS;
    text += ` · Round-game bonus: +${ROUND_GAME_BONUS} for each winner.`;
  }
  // Winning a contest earns a Director Cue (Showtime). Passive spaces never pass winners.
  const newCues = [];
  for (const id of showtime(room) ? won : []) {const w = room.players.find(p => p.id === id); if ((w.cues || 0) < DIRECTORS_CUES) {w.cues = (w.cues || 0) + 1; newCues.push(w.name);}}
  if (newCues.length) text += ` · Director Cue earned: ${newCues.join(' & ')}.`;
  const before = b.turnStartSparks || {};
  // Two-player comeback: a trailing contestant gains two extra Sparks only when
  // winning a contest from a gap of 2+ (One at a time) or 4+ (Everyone Rolls).
  const comeback = room.players.length === 2 ? won.filter(id => Number.isInteger(before[id]) && Math.max(...Object.values(before)) - before[id] >= (everyone(room) ? 4 : 2)) : [];
  for (const id of comeback) room.players.find(p => p.id === id).sparks += 2;
  if (comeback.length) text += ` · Comeback bonus: ${comeback.map(id => nameOf(room, id)).join(' & ')} +2 Sparks!`;
  // Underdog boost (4+ players), judged against scores at the START of this turn.
  const initialLeader = Math.max(0, ...Object.values(before));
  const underdogs = won.filter(id => room.players.length >= 4 && Number.isInteger(before[id]) && initialLeader - before[id] >= UNDERDOG_THRESHOLD);
  const bonus = room.players.length >= 8 ? UNDERDOG_BONUS_EIGHT : UNDERDOG_BONUS_SMALL;
  for (const id of underdogs) room.players.find(x => x.id === id).sparks += bonus;
  if (underdogs.length) text += ` · Underdog boost: ${underdogs.map(id => nameOf(room, id)).join(' & ')} +${bonus}!`;
  // LAST ORDERS: in the final round every Spark gained is doubled. Losses are not.
  if (lastOrders(b)) {
    const doubled = [];
    for (const p of room.players) {
      const gain = p.sparks - (Number.isInteger(before[p.id]) ? before[p.id] : p.sparks);
      if (gain > 0) {p.sparks += gain; doubled.push(`${p.name} +${gain}`);}
    }
    if (doubled.length) text += ` · LAST ORDERS DOUBLES IT: ${doubled.join(', ')}.`;
  }
  b.step = 'result'; b.deadline = null; b.nextAt = now + presentationLeft(b, now) + (room.settings.timerSpeed === 'relaxed' ? 4200 : 2900);
  // Per-player Spark change for this verdict, so the TV podium and each phone can show it.
  const deltas = Object.fromEntries(room.players.map(p => [p.id, p.sparks - (Number.isInteger(before[p.id]) ? before[p.id] : p.sparks)]).filter(([, d]) => d !== 0));
  b.result = {text, winners: won, underdogs, deltas}; b.event = {type: 'result', text};
  b.history.push({turn: b.turn, round: b.roundNo, name: actor(room)?.name || 'Show', text}); if (b.history.length > 60) b.history.shift();
  const max = Math.max(...room.players.map(p => p.sparks));
  b.leaderIds = room.players.filter(p => p.sparks === max).map(p => p.id);
  // Later steps in this round measure their gains from here, so nothing is doubled twice.
  b.turnStartSparks = snapshot(room);
}

function resetTurnFlags(room) {
  const b = room.board;
  b.presentUntil = null;
  b.routePlan = false; b.routeOptions = []; b.rolls = []; b.result = null; b.deadline = null; b.nextAt = null;
  b.turnStartSparks = snapshot(room);
}
function startRoundGame(room, now, rng = crypto.randomInt) {
  const b = room.board, n = room.players.length;
  const called = Boolean(b.roundCategory && room.players.some(p => p.id === b.roundCaller));
  const category = called ? b.roundCategory : CATEGORIES[random(CATEGORIES.length, rng)];
  const fallback = everyone(room) && b.round ? b.round.spotlightId : room.players[(b.roundNo - 1) % n].id;
  const hostId = called ? b.roundCaller : fallback;
  b.stage = 'round-game'; b.activeId = hostId; b.turn++; resetTurnFlags(room);
  if (b.round) b.round.stage = 'minigame';
  (category === 'speed' || category === 'brain' ? phase3 : phase4).start(room, category, now, rng);
  const intro = called ? `${nameOf(room, hostId)} called it and hosts` : `Nobody called a game, so the studio picked ${LABELS[category].toUpperCase()}. ${nameOf(room, hostId)} hosts`;
  b.event = {...b.event, text: `${lastOrders(b) ? 'LAST ORDERS · ' : ''}ROUND ${b.roundNo} GAME · ${intro}. ${b.event?.text || ''}`};
}
function endGame(room, now) {
  const b = room.board, max = Math.max(...room.players.map(p => p.sparks));
  const top = room.players.filter(p => p.sparks === max).map(p => p.id);
  b.leaderIds = top;
  if (top.length === 1) {
    const text = `${nameOf(room, top[0])} wins NOGGIN with ${plural(max, 'Spark')}!`;
    b.finalists = top; b.winnerIds = top; b.step = 'finished'; room.phase = 'finished'; b.nextAt = null; b.deadline = null;
    b.result = {text, winners: top}; b.event = {type: 'finished', text}; return;
  }
  b.finalists = top; b.stage = 'noggin-off';
  phase5.start(room, 'tiebreak', now, null);
}
function nextRoundState(b) {
  b.roundNo++; b.turnInRound = 0; b.stage = 'board';
  b.roundCategory = null; b.roundCaller = null; b.roundLocked = false; b.showdownPlayed = false;
}
function nextTurn(room, now, rng = crypto.randomInt) {
  const b = room.board;
  if (b.stage === 'round-game') {
    if (b.roundNo >= b.totalRounds) {endGame(room, now); return;}
    nextRoundState(b);
    if (everyone(room)) {beginRound(room, now); return;}
  } else if (everyone(room)) {continueRound(room, now, rng); return;}
  else {
    b.turnInRound++;
    if (b.turnInRound >= room.players.length) {startRoundGame(room, now, rng); return;}
  }
  b.activeId = boardTurnPlayer(room).id; b.turn++; resetTurnFlags(room); b.step = 'await_roll';
  const p = actor(room);
  b.event = {type: 'turn', text: b.turnInRound === 0
    ? (lastOrders(b) ? `LAST ORDERS! Final round — every Spark you win is doubled. ${p.name} rolls first.` : `ROUND ${b.roundNo} OF ${b.totalRounds}. ${p.name} rolls first.`)
    : `${p.name}'s turn: roll the die!`};
}

function minigameInput(room, id, value, roundKey, now) {
  if (room.board.step === 'showdown') return phase5.submit(room, id, value, roundKey, now, finishTurn);
  return room.board.minigame && phase4.SPECS[room.board.minigame.id] ? phase4.submit(room, id, value, roundKey, now, finishTurn) : phase3.submit(room, id, value, roundKey, now);
}
function minigameDraw(room, id, points, roundKey, now) {return phase4.draw(room, id, points, roundKey, now);}

// All live clocks are owned by the server. Pauses must shift BOTH deadlines and
// the visual cue timestamps supplied to phones and the TV.
function resumeClocks(room, now, {preserveGrace = false} = {}) {
  const b = room.board;
  if (!Number.isFinite(b?.pausedAt)) return 0;
  const delta = Math.max(0, now - b.pausedAt);
  const move = (obj, key) => {if (obj && Number.isFinite(obj[key])) obj[key] += delta;};
  for (const key of ['deadline', 'nextAt']) move(b, key);
  move(b.challenge, 'deadline');
  for (const key of ['deadline', 'hardStop', 'openAt', 'startedAt']) move(b.showdown, key);
  for (const key of ['deadline', 'openAt', 'introUntil', 'stageStarted']) move(b.minigame, key);
  for (const key of ['readyAt', 'flashEndsAt', 'revealAt']) move(b.minigame?.display, key);
  if (preserveGrace) for (const p of room.players) move(p, 'offlineSince');
  b.pausedAt = null; b.pauseKind = null; b.pauseReason = null;
  return delta;
}
function hostPause(room, now) {
  const b = room.board;
  if (room.phase !== 'board' || !b || b.step === 'finished') fail('PHASE', 'No active game to pause.');
  if (Number.isFinite(b.pausedAt)) fail('PAUSED', 'The game is already paused.');
  b.pausedAt = now; b.pauseKind = 'manual'; b.pauseReason = 'The TV host has paused the show.';
  b.event = {type: 'pause', text: 'SHOW PAUSED · The host will resume play.'};
}
function hostResume(room, now) {
  const b = room.board;
  if (room.phase !== 'board' || !b || b.pauseKind !== 'manual') fail('PHASE', 'Only a host-paused show can be resumed manually.');
  resumeClocks(room, now, {preserveGrace: true});
  b.event = {type: 'resume', text: 'BACK ON AIR · The show continues!'};
}
function forfeitDisconnected(room, now) {
  const b = room.board, p = actor(room);
  b.challenge = null; b.minigame = null; b.showdown = null; b.deadline = null;
  finishTurn(room, now, b.stage === 'round-game' ? `${p.name} disconnected, so this round's game was cancelled.` : `${p.name} disconnected. Their turn was skipped.`);
}
function skipDisconnected(room, now) {
  const b = room.board;
  if (room.phase !== 'board' || !b || ['result', 'finished'].includes(b.step)) fail('PHASE', 'There is no active turn to skip.');
  const p = actor(room);
  if (p?.socketId || !Number.isFinite(p?.offlineSince)) fail('ONLINE', 'Only the disconnected active contestant can be skipped.');
  if (b.pauseKind === 'manual') fail('PAUSED', 'Resume the show before skipping the disconnected player.');
  resumeClocks(room, now);
  forfeitDisconnected(room, now);
}
function tick(room, now, rng = crypto.randomInt) {
  if (room.phase !== 'board' || !room.board) return false;
  const b = room.board;
  if (!room.hostSocketId) return false;
  if (b.pauseKind === 'manual') return false;
  // Shared rolling and movement never wait for one phone: missing rolls are made by the server.
  if (everyone(room) && b.round && ['round_roll', 'round_moving'].includes(b.step)) {
    if (Number.isFinite(b.pausedAt)) {resumeClocks(room, now); return true;}
    return tickRound(room, now, rng);
  }
  const p = actor(room);
  if (p && !p.socketId && !['result', 'finished'].includes(b.step) && b.stage !== 'noggin-off') {
    if (p.offlineSince !== null && now - p.offlineSince >= 30_000) {resumeClocks(room, now); forfeitDisconnected(room, now); return true;}
    if (!Number.isFinite(b.pausedAt)) {b.pausedAt = now; b.pauseKind = 'player'; b.pauseReason = 'Waiting up to 30 seconds for the active player to reconnect.'; return true;}
    return false;
  }
  if (Number.isFinite(b.pausedAt)) {resumeClocks(room, now); return true;}
  if (b.step === 'showdown') return phase5.tick(room, now, finishTurn);
  if (b.step === 'minigame') return b.minigame && phase4.SPECS[b.minigame.id] ? phase4.tick(room, now, finishTurn, rng) : phase3.tick(room, now, finishTurn, rng);
  if (b.step === 'challenge' && now >= b.challenge.deadline) {resolveChallenge(room, now); return true;}
  if (b.step === 'result' && now >= b.nextAt) {nextTurn(room, now, rng); return true;}
  if (b.deadline && now >= b.deadline) {
    if (b.step === 'choose_die') {beginMove(room, b.rolls[0], now, rng); return true;}
    if (b.step === 'choose_route') {const i = b.routeOptions.findIndex(o => o.cost === 0); choose(room, b.activeId, {option: i < 0 ? 0 : i}, now, rng); return true;}
    if (b.step === 'choose_category') {choose(room, b.activeId, {category: CATEGORIES[random(CATEGORIES.length, rng)]}, now, rng); return true;}
    if (b.step === 'choose_target' || b.step === 'choose_opponent') {
      const t = leaderExcept(room, b.activeId);
      if (!t) {finishTurn(room, now, 'No opponent available.'); return true;}
      choose(room, b.activeId, {targetId: t.id}, now, rng); return true;
    }
  }
  return false;
}

module.exports = {
  SPACES, COLORS, ICONS, LABELS, LIFTS, SHOWDOWNS, CATEGORIES, ROUND_OPTIONS, DEFAULT_ROUNDS, autoRounds,
  publicBoard, start, beginRound, roundRoll, roll, pickDie, choose, answer, tick, finishTurn, nextTurn, startRoundGame, endGame, beginMove, resolveChallenge,
  minigameInput, minigameDraw, hostPause, hostResume, skipDisconnected, resumeClocks,
  DIRECTORS_CUES, DIRECTORS_CHOICE_MS, ROUND_ROLL_MS, ROUND_MOVE_MS, DICE_SHOW_MS, HOP_MS, SETTLE_MS, presentMs, START_LAND_BONUS, START_PASS_BONUS, APPLAUSE_BONUS, ROUND_GAME_BONUS, CORNER_BONUS,
  UNDERDOG_THRESHOLD, UNDERDOG_BONUS_SMALL, UNDERDOG_BONUS_EIGHT
};
