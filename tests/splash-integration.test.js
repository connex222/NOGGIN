'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../public/tv/showcase.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../public/tv/tv.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../public/tv/index.html'), 'utf8');

test('cinematic intro uses already loaded showcase script and existing NOGGIN logo', () => {
  assert.match(html, /src="\/tv\/showcase\.js"/);
  assert.match(script, /gn-cinema-brand/);
  assert.match(script, /\/play\/art\/noggin-logo\.webp/);
});
test('skip completes intro without touching live gameplay state', () => {
  assert.match(script, /gn-cinema-skip.*addEventListener\('click', finish\)/);
  assert.match(script, /clearTimeout\(phaseTimer\)/);
  assert.match(script, /overlay\.remove\(\)/);
});
test('rejoining sessions bypass the splash', () => {
  for (const key of ['room', 'token', 'playerId', 'reconnect', 'skipIntro']) {
    assert.ok(script.includes("query.has('"+key+"')"), key);
  }
  assert.match(script, /sessionStorage\.getItem\('gn-noggin-intro-seen'\)/);
});
test('mute is persisted, and Web Audio playback is optional', () => {
  assert.match(script, /localStorage\.setItem\('gn-intro-muted'/);
  assert.match(script, /AudioContextCtor/);
  assert.match(script, /catch \(_\) \{ \/\* Optional audio/);
});
test('reduced motion and TV/mobile responsive escape controls', () => {
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(css, /gn-cinema-actions/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
