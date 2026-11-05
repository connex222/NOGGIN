'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const html = read('public/tv/index.html');
const showcase = read('public/tv/showcase.js');
const tutorial = read('public/tv/tutorial.js');

test('no GAME NIGHT or NOGGIN intro is started by the TV entrypoint', () => {
  assert.doesNotMatch(html, /cinematic-v4\\.js|gn-v4-early-script|gn-v4-early-style|NOGGIN_CINEMATIC_V4/);
  assert.doesNotMatch(showcase, /gn-cinema-brand|gn-cinema-progress|gn-cinema-skip/);
});
test('NOGGIN opens straight into its live lobby without the static welcome screen', () => {
  assert.match(html, /<section id="welcomeScreen"[^>]*\\bhidden>/);
  assert.match(html, /id="lobbyGrid"/);
  assert.match(html, /id="roomCode"/);
  assert.match(html, /id="qrImage"/);
});
test('HEADSTART remains reachable from the lobby after bypassing the welcome', () => {
  assert.match(html, /id="lobbyHeadstart"/);
  assert.match(tutorial, /'lobbyHeadstart'/);
});
