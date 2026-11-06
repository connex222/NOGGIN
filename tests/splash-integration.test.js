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
  assert.doesNotMatch(html, /cinematic-v4\.js|gn-v4-early-script|gn-v4-early-style|NOGGIN_CINEMATIC_V4/);
  assert.doesNotMatch(showcase, /gn-cinema-brand|gn-cinema-progress|gn-cinema-skip/);
});
test('NOGGIN opens straight into its live lobby without the static welcome screen', () => {
  assert.match(html, /<section id="welcomeScreen"[^>]*\bhidden>/);
  assert.match(html, /id="lobbyGrid"/);
  assert.match(html, /id="roomCode"/);
  assert.match(html, /id="qrImage"/);
});
test('HEADSTART remains reachable from the lobby after bypassing the welcome', () => {
  assert.match(html, /id="lobbyHeadstart"/);
  assert.match(tutorial, /'lobbyHeadstart'/);
});

test('settings tutorial button is inside settings and correctly wired', () => {
  const block = html.slice(html.indexOf('id="lobbyControls"'),html.indexOf('</section>',html.indexOf('id="lobbyControls"')));
  assert.match(block,/id="lobbyHeadstart"[^>]*aria-label="Open the NOGGIN How to Play tutorial"/);
  assert.match(tutorial,/\['welcomeHeadstart', 'rulesHeadstart', 'lobbyHeadstart'\]/);
  assert.match(tutorial,/Promise\.resolve\(open\(\)\)/);
});
test('decorative lobby avatars never obscure the approved game logo', () => {
  const css=read('public/tv/showcase.css');
  assert.match(css,/body\.tv:not\(\.playing\) #lobbyCast \{display:none!important;\}/);
  assert.match(css,/#lobbyControls #lobbyHeadstart \{/);
});
test('HTML, JS and CSS are never cached over an updated release', () => {
  const server=read('server/index.js');
  assert.match(server,/setHeaders\(res, filePath\)/);
  assert.match(server,/no-store, max-age=0/);
});
