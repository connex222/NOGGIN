'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('TV has an authenticated game-lobby return and a safe fullscreen control',()=>{
 const html=read('public/tv/index.html');
 const tv=read('public/tv/tv.js');
 const fsControl=read('public/shared/fullscreen.js');
 assert.match(html,/id="showBackLobby"/);
 assert.match(tv,/U\.request\(socket,'game:lobby'/);
 assert.match(html,/shared\/fullscreen\.js/);
 assert.match(fsControl,/collection-fullscreen-docked/);
 assert.match(html,/id="musicButton"/);
});
test('phone can leave to the main Games Night lobby without hiding answers',()=>{
 const html=read('public/play/index.html');
 const css=read('public/play/studio.css');
 assert.match(html,/<nav class="phone-return-nav"/);
 assert.match(html,/games-night-wfmz\.onrender\.com/);
 assert.match(css,/\.phone-return-nav\{display:flex/);
 assert.doesNotMatch(css,/\.phone-return-nav\{[^}]*position:(fixed|absolute)/);
 assert.match(html,/shared\/fullscreen\.js/);
});
test('TV action controls wrap on tablets or narrow displays',()=>{
 const css=read('public/tv/tv.css');
 assert.match(css,/\.tv-header\{min-width:0;flex-wrap:wrap\}/);
 assert.match(css,/\.header-actions \.sound-tools\{display:flex/);
 assert.match(css,/@media\(max-width:1000px\)/);
});
