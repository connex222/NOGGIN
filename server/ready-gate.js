'use strict';
// READY CHECK (playtest fix: "too frantic, no time to read the rules").
// A round game's or showdown's how-to-play card stays up until every online
// contestant taps GOT IT on their phone. Then a short 3-2-1 countdown runs and
// the game starts. Nobody can be stuck forever: the TV host can start it, and
// a safety cap starts it automatically. Offline phones are never waited for.
const READY_CAP_MS = 45000;      // safety net: start anyway after 45 s
const READY_MIN_MS = 1500;       // the card is always seen for a moment
const READY_COUNTDOWN_MS = 3000; // 3-2-1 after the last GOT IT
const KEYS = ['introUntil', 'openAt', 'deadline', 'hardStop', 'stageStarted'];
const DISPLAY_KEYS = ['readyAt', 'flashEndsAt', 'revealAt'];

function fail(code, message) {const e = new Error(message); e.code = code; throw e;}
function shift(m, delta) {
  for (const k of KEYS) if (Number.isFinite(m[k])) m[k] += delta;
  if (m.display) for (const k of DISPLAY_KEYS) if (Number.isFinite(m.display[k])) m.display[k] += delta;
}
function participants(m) {return m.participants || m.players || [];}
function current(room) {
  const b = room.board;
  if (!b) return null;
  if (b.step === 'minigame' && b.minigame?.phase === 'intro') return b.minigame;
  if (b.step === 'showdown' && b.showdown?.phase === 'intro') return b.showdown;
  return null;
}
function introEnd(m) {return Number.isFinite(m.introUntil) ? m.introUntil : m.deadline;}

// Called by each game's start() straight after it sets its own intro length.
// Every clock is pushed out to the safety cap; release() pulls them back in.
function open(room, m, now, introMs) {
  if (room.settings?.readyCheck === false) return; // legacy fixed-length intro
  if (!Number.isFinite(m.introUntil)) m.introUntil = m.deadline;
  const extra = Math.max(0, READY_CAP_MS - introMs);
  shift(m, extra);
  m.readyGate = true; m.readyReleased = false; m.readyIds = [];
  m.readyFrom = now + READY_MIN_MS;
  if (room.board) room.board.deadline = m.deadline;
}
function waitingFor(room, m) {
  return participants(m).filter(id => {
    const p = room.players.find(x => x.id === id);
    return p && p.socketId && !m.readyIds.includes(id);
  });
}
function release(room, m, now) {
  if (!m?.readyGate || m.readyReleased) return false;
  const target = now + READY_COUNTDOWN_MS;
  const left = introEnd(m) - target;
  if (left > 0) shift(m, -left);
  m.readyReleased = true;
  if (room.board) room.board.deadline = m.deadline;
  return true;
}
function markReady(room, id, now) {
  const m = current(room);
  if (!m || !m.readyGate) fail('STEP', 'There is nothing to get ready for right now.');
  if (!participants(m).includes(id)) fail('WATCH', 'You are watching this one. Enjoy the show!');
  if (!m.readyIds.includes(id)) m.readyIds.push(id);
  check(room, now);
}
function check(room, now) {
  const m = current(room);
  if (!m || !m.readyGate || m.readyReleased || now < m.readyFrom) return false;
  if (waitingFor(room, m).length) return false;
  return release(room, m, now);
}
function hostStart(room, now) {
  const m = current(room);
  if (!m || !m.readyGate || m.readyReleased) fail('STEP', 'The game has already started.');
  return release(room, m, now);
}
function publicReady(room, m) {
  if (!m?.readyGate || m.phase !== 'intro') return null;
  return {ids: m.readyIds.slice(), waiting: waitingFor(room, m), released: Boolean(m.readyReleased), startsAt: m.readyReleased ? introEnd(m) : null};
}
module.exports = {READY_CAP_MS, READY_MIN_MS, READY_COUNTDOWN_MS, open, release, markReady, check, hostStart, publicReady, current};
