'use strict';
// HEADSTART (the TV tutorial) must never teach the wrong rules. These tests check
// every number and game name it quotes against the live server code.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const board = require('../server/board');
const phase3 = require('../server/games/phase3');
const phase4 = require('../server/games/phase4');
const phase5 = require('../server/games/phase5');
const layout = require('../server/layout');
const {LOBBY_GRACE_MS} = require('../server/rooms');

const src = read('public/tv/tutorial.js');
function loadTutorial() {
  const context = {window: {}, document: {readyState: 'loading', addEventListener() {}, getElementById() {return null;}}, localStorage: {getItem() {return null;}, setItem() {}}, performance: {now: () => 0}, console};
  context.window.matchMedia = () => ({matches: false});
  vm.createContext(context);
  vm.runInContext(src, context);
  return context.window.NogginHeadstart;
}
const guide = JSON.parse(require('node:child_process').execFileSync('node', [path.join(__dirname, '../tools/export-guide-data.js')], {encoding: 'utf8'}));

test('HEADSTART quotes the same numbers the server uses', () => {
  const {facts} = loadTutorial();
  assert.equal(facts.hostWin, guide.roundScore.hostWin);
  assert.equal(facts.otherWinner, guide.roundScore.otherWinner);
  assert.equal(facts.teamWin, 1 + guide.roundGameBonus);
  assert.equal(facts.applause, guide.applause);
  assert.equal(facts.startPass, guide.bonusStart.pass);
  assert.equal(facts.startLand, guide.bonusStart.land);
  assert.equal(facts.showdownTransfer, guide.showdownTransfer);
  assert.equal(facts.cornerBonus, guide.cornerBonus);
  assert.equal(facts.underdogThreshold, guide.catchUp.threshold);
  assert.equal(facts.underdogBonus, guide.catchUp.extraSmall);
  assert.equal(facts.underdogBonusEight, guide.catchUp.extraEight);
  assert.equal(facts.autoRoundsSmall, guide.autoRounds.everyoneSmall);
  assert.equal(facts.autoRoundsLarge, guide.autoRounds.everyoneLarge);
  assert.equal(facts.boardSpaces, layout.SPACES.length);
  assert.equal(facts.buzzerTarget, phase5.BUZZER_TARGET);
  assert.equal(facts.pickMs, board.PICK_MS);
  assert.equal(facts.lobbyHoldMinutes * 60_000, LOBBY_GRACE_MS);
});

test('HEADSTART names all 16 games exactly as the server does, in the right categories', () => {
  const {games} = loadTutorial();
  const all = Object.entries(games).flatMap(([cat, list]) => list.map(([id, name]) => ({cat, id, name})));
  assert.equal(all.length, 16);
  for (const g of all) {
    const spec = phase3.SPECS[g.id] || phase4.SPECS[g.id];
    assert.ok(spec, g.id);
    assert.equal(spec.name, g.name, g.id);
    assert.equal(spec.category, g.cat, g.id);
  }
});

test('HEADSTART has the slides a new player needs, and a finale that starts a room', () => {
  const {slides} = loadTutorial();
  assert.ok(slides.length >= 15);
  const titles = slides.map(s => s.title).join(' | ');
  for (const needle of [/Join/, /board/i, /rolls/i, /call the game/i, /SPEED/, /BRAIN/, /CREATE/, /TOGETHER/, /Sparks/, /Showdown/, /Special spaces/, /Last Orders/, /winner/i]) assert.match(titles, needle);
  for (const s of slides) {
    assert.ok(s.lines.length >= 2 && s.lines.length <= 4, s.title);
    for (const line of s.lines) assert.ok(line.length <= 140, `${s.title}: line too long for the TV`);
  }
  assert.equal(slides.at(-1).finale, true);
  assert.match(src, /document\.getElementById\('welcomeStart'\)\?\.click\(\)/);
  assert.doesNotMatch(src, /Swap Seats/);
});

test('The front page has a HEADSTART button and the TV page loads the tutorial', () => {
  const html = read('public/tv/index.html');
  assert.match(html, /id="welcomeHeadstart"[^>]*>.*HEADSTART/);
  assert.match(html, /id="rulesHeadstart"/);
  assert.match(html, /<script src="\/tv\/tutorial\.js"><\/script>/);
  assert.match(html, /href="\/tv\/tutorial\.css"/);
});

test('HEADSTART can be driven from a TV remote or keyboard, and reads aloud', () => {
  for (const key of ['ArrowRight', 'ArrowLeft', 'Escape', "' '", 'Home', 'MediaPlayPause']) assert.ok(src.includes(key), key);
  assert.match(src, /speechSynthesis/);
  assert.match(src, /prefers-reduced-motion/);
});
