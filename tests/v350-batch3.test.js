'use strict';
// NOGGIN v3.5.0 Batch 3 — phone input reliability: D6, D11, D12, D15, D16.
// The live-DOM behaviour is checked in Chromium by tools/v350-phone-input-smoke.py.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const game = require('../server/games/phase3');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('D15: Odd Spot level 5 is a size difference, readable in sunlight', () => {
  const room = {players: [{id: 'a'}, {id: 'b'}], settings: {rules: 'classic', timerSpeed: 'normal'}, board: {}};
  game.start(room, 'speed', 1000, () => 0, 'odd-spot');
  for (let i = 1; i < 5; i++) game.nextRound(room, 1000 + i * 20000, () => 0);
  const m = room.board.minigame;
  assert.equal(m.round, 5);
  const smaller = m.display.styles.filter(s => s.scale && s.scale < 1);
  assert.equal(smaller.length, 1);
  assert.ok(smaller[0].scale <= 0.7, 'the difference must be obvious, not subtle');
  assert.ok(m.display.styles.every(s => !s.tone), 'no faint colour shades');
  assert.match(m.question, /smaller/);
  // The phone and TV both draw the scale.
  assert.match(read('public/play/play.js'), /style\?\.scale/);
  assert.match(read('public/tv/board-view.js'), /style\?\.scale/);
});

test('D15: phone CSS sets a 48 px minimum for tap targets and widens the Odd Spot grid', () => {
  const css = read('public/play/studio.css');
  const tail = css.slice(css.indexOf('v3.5.0 D15'));
  assert.ok(tail.length > 50, 'D15 block is present and last');
  assert.match(tail, /min-height:48px/);
  assert.match(tail, /min-width:48px/);
  assert.match(tail, /repeat\(6,minmax\(48px,1fr\)\)/);
});

test('D11: the TV countdown plays once at 3 seconds and never on short rounds', () => {
  const tv = read('public/tv/tv.js');
  assert.doesNotMatch(tv, /lastBeat/, 'old per-second trigger removed');
  assert.match(tv, /beatSkip=remainingMs<5000/);
  assert.match(tv, /!beatDone&&sec>=1&&sec<=3\)\{beatDone=true;audio\.play\('sfx-countdown'\)/);
  // Simulate the TV's 160 ms ticker for a 12 s round and a 2.5 s round.
  const plays = (lengthMs) => {
    let beatFor = null, beatDone = false, beatSkip = false, count = 0;
    const at = 100_000;
    for (let t = at - lengthMs; t < at; t += 160) {
      const sec = Math.ceil((at - t) / 1000), remainingMs = sec * 1000;
      if (at !== beatFor) {beatFor = at; beatDone = false; beatSkip = remainingMs < 5000;}
      if (!beatSkip && !beatDone && sec >= 1 && sec <= 3) {beatDone = true; count++;}
    }
    return count;
  };
  assert.equal(plays(12_000), 1);
  assert.equal(plays(2_500), 0);
  assert.equal(plays(4_000), 0);
});

test('D6/D12/D16: phone keeps controls, VIP panel and profile as designed', () => {
  const phone = read('public/play/play.js');
  assert.match(phone, /function patchControls/);
  assert.match(phone, /drawControlsPatched/);
  assert.match(phone, /dataset\.busy/);
  assert.match(phone, /blocked=Boolean\(m\.blocked\?\.\[player\.id\]/, 'own lock-out is part of the control key');
  assert.match(phone, /pickerKey/);
  assert.match(phone, /if\(nextKey===vipKey\)return;/);
  assert.match(phone, /'noggin-player-profile-v1'/);
  assert.match(phone, /function prefillProfile/);
});

test('Browser smoke results are recorded and all passed', () => {
  const file = path.join(__dirname, '..', 'docs/test-history/v350-phone-input-browser-results.json');
  const results = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(results.checked >= 19);
  assert.ok(results.results.every(r => r.ok));
});
