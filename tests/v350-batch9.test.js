'use strict';
// NOGGIN v3.5.0 Batch 9 — rules, docs and tidy-up: G9, G10, D14, D17, D18, version, CHANGELOG.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

test('G9: Memory Lane and Count Flash have Classic how-to steps, used on TV and phone', () => {
  const howto = JSON.parse(read('public/shared/howto.json'));
  for (const id of ['memory-lane', 'count-flash']) {
    const steps = howto[id].classicSteps;
    assert.equal(steps.length, 3, id);
    for (const [, text] of steps) assert.ok(text.length >= 6 && text.length <= 34, text);
  }
  assert.doesNotMatch(JSON.stringify(howto['memory-lane'].classicSteps), /BACKWARDS/i);
  assert.match(read('public/tv/board-view.js'), /rules!=='showtime'&&entry\?\.classicSteps/);
  assert.match(read('public/play/play.js'), /rules!=='showtime'&&e\?\.classicSteps/);
});

test('G10: the rules sheet describes the v3.5.0 scoring', () => {
  const src = read('tools/make-how-to-play.py');
  for (const needle of [/Team games — Relay Sums/, /Bomb Squad defused/, /Sketch & Sabotage: artist/, /Steal the Call/, /outside the top two/, /one replay at most/, /never when everyone ties/, /Buzzer Battle is first to 3/]) {
    assert.match(src, needle);
  }
  assert.doesNotMatch(src, /Swap Seats/);
  assert.ok(exists('HOW-TO-PLAY.pdf'));
});

test('D14: the body font is a small Latin subset, with the full original kept for rebuilding', () => {
  const size = fs.statSync(path.join(root, 'public/shared/fonts/lato-regular.woff2')).size;
  assert.ok(size < 40_000, `${size} bytes`);
  assert.ok(exists('source-art/fonts/lato-regular-full.woff2'));
  assert.match(read('README.md'), /pyftsubset source-art\/fonts\/lato-regular-full\.woff2/);
});

test('D17: junk files and unreachable tie-break code are gone; welcome focuses a real control', () => {
  for (const file of ['public/sounds/sfx-hop .mp3', 'public/sounds/spinopel-spinning-roulette-wheel-429832.mp3', 'data/demo-questions.json']) assert.ok(!exists(file), file);
  const boardSrc = read('server/board.js');
  assert.doesNotMatch(boardSrc, /c\.kind === 'tiebreak'/);
  assert.doesNotMatch(boardSrc, /beginChallenge\(room, 'tiebreak'/);
  const showcase = read('public/tv/showcase.js');
  assert.doesNotMatch(showcase, /goToLobby\('target'\)/);
  assert.match(showcase, /'stageReady'/);
  const readme = read('README.md');
  assert.match(readme, /`source-art\/`.*Not served to players/s);
  assert.match(readme, /`docs\/previews\/`/);
});

test('D18: the audio README warns before public release', () => {
  assert.match(read('public/sounds/README.md'), /Before public release/);
});

test('Version is 3.5.0 and the CHANGELOG lists every brief item', () => {
  assert.equal(JSON.parse(read('package.json')).version, '3.5.0-alpha.1');
  const top = read('CHANGELOG.md').split('# NOGGIN v3.4.0')[0];
  assert.match(top, /^# NOGGIN (?:Alpha )?v3\.5\.0/);
  const ids = [...Array(18).keys()].map(i => `D${i + 1}`).concat([...Array(12).keys()].map(i => `G${i + 1}`), [...Array(9).keys()].map(i => `Q${i + 1}`));
  for (const id of ids) assert.match(top, new RegExp(`\\*\\*${id}\\*\\*`), id);
});
