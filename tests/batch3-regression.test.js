'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('D6: phone preserves live controls and drawing canvas across broadcasts', () => {
  const phone = read('public/play/play.js');
  assert.match(phone, /function controlKey\(player,b\)/);
  assert.match(phone, /const sameControls=!b\.paused&&freshKey===interactionKey/);
  assert.match(phone, /if\(sameControls&&activeCanvas\)/);
  assert.match(phone, /if\(sameControls\)\{drawControlsPatched\(/);
  assert.match(phone, /if\(!sameControls\)\{/);
  assert.match(phone, /if\(grid\.dataset\.pickerKey===pickerKey&&grid\.childElementCount\)return/);
});

test('D12/D16: VIP controls and profile survive routine refreshes', () => {
  const phone = read('public/play/play.js');
  assert.match(phone, /const nextKey=\[isVip,roomState\?\.phase/);
  assert.match(phone, /if\(nextKey===vipKey\)return/);
  assert.match(phone, /noggin-player-profile-v1/);
  assert.match(phone, /function saveProfile\(name, avatarId\)/);
});

test('D15: Odd Spot touch targets have at least 48px minimum in both phone stylesheets', () => {
  const phone = read('public/play/play.css');
  const studio = read('public/play/studio.css');
  assert.match(phone, /\.mini-grid-button\{min-height:48px!important/);
  assert.match(studio, /\.game-buttons \.mini-grid-button\{[^\n]*min-height:clamp\(48px,13\.6vw,58px\)!important/);
});

test('D11: countdown cue plays once only for rounds long enough to hear it', () => {
  const tv = read('public/tv/tv.js');
  assert.match(tv, /beatSkip=remainingMs<5000/);
  assert.match(tv, /if\(!beatSkip&&!beatDone&&sec>=1&&sec<=3\)/);
  assert.match(tv, /beatDone=true;audio\.play\('sfx-countdown'\)/);
});
