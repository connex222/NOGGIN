'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'public/tv/showcase.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/tv/tv.css'), 'utf8');
const stage = fs.readFileSync(path.join(root, 'public/tv/studio-v3.svg'), 'utf8');

test('V3 is a real 15-second staged sequence with the original approved NOGGIN logo', () => {
  for (const time of ['1000', '3000', '6000', '9500', '12000', '14000', '15000']) assert.ok(js.includes(time), time);
  assert.match(js, /doneTimer = setTimeout\(finish, 15000\)/);
  assert.match(js, /\/play\/art\/noggin-logo\.webp/);
  assert.match(js, /gn-scene-/);
  assert.match(js, /USE YOUR HEAD\. TRUST YOUR NERVE/);
});
test('V3 studio artwork is bundled locally and contains stage geometry', () => {
  assert.match(stage, /^<svg /);
  assert.match(stage, /viewBox="0 0 1920 1080"/);
  assert.match(css, /url\('\/tv\/studio-v3\.svg'\)/);
  assert.match(css, /gn-scene-5/);
});
test('V3 preserves skip, mute, reconnect, motion and timers', () => {
  assert.match(js, /gn-cinema-skip.*addEventListener\('click', finish\)/);
  assert.match(js, /sessionStorage\.getItem\('gn-noggin-intro-seen'\)/);
  for (const key of ['room', 'token', 'playerId', 'reconnect', 'skipIntro']) assert.ok(js.includes("query.has('" + key + "')"));
  assert.match(js, /localStorage\.setItem\('gn-intro-muted'/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /for \(const timer of stageTimers\) clearTimeout\(timer\)/);
  assert.match(js, /overlay\.remove\(\)/);
});
