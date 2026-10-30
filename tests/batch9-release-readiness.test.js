'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Batch 9: published version and release notes document all brief items',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.version,'3.5.0-alpha.1');
 const changes=read('CHANGELOG.md');
 assert.match(changes,/Batch 9 — Rules, docs and tidy-up/);
 for(const id of ['G9','G10','D14','D17','D18']) assert.match(changes,new RegExp('\\b'+id+'\\b'));
});
test('G9: mode-specific Count Flash and Memory Lane instructions exist',()=>{
 const cards=JSON.parse(read('public/shared/howto.json'));
 for(const id of ['count-flash','memory-lane']){
  assert.equal(cards[id].steps.length,3);
  assert.equal(cards[id].classicSteps.length,3);
 }
 assert.match(read('public/tv/board-view.js'),/classicSteps/);
 assert.match(read('public/play/play.js'),/classicSteps/);
});
test('G10: generated guide reads current engine figures and social game rules',()=>{
 const guide=read('tools/export-guide-data.js');
 assert.match(guide,/require\('\.\.\/server\/board'\)/);
 assert.match(guide,/require\('\.\.\/server\/games\/phase4'\)/);
 assert.match(guide,/showdownTransfer:2/);
 assert.match(read('tools/make-how-to-play.py'),/export-guide-data\.js/);
});
test('D14 and D18: font subset instructions and outstanding media rights are documented',()=>{
 const readme=read('README.md');
 const audio=read('public/sounds/README.md');
 assert.match(readme,/pyftsubset/);
 assert.match(readme,/source-art\//);
 assert.match(readme,/docs\/previews\//);
 assert.match(readme,/before (?:any )?public release|before external distribution/i);
 assert.match(readme,/licensing clearance|rights evidence/i);
 assert.match(audio,/Before public release/);
 assert.match(audio,/licensing have not been independently verified/);
});
test('D17: old files absent and lobby navigation does not focus an invalid target',()=>{
 for(const item of ['public/sounds/sfx-hop .mp3','public/sounds/spinopel-spinning-roulette-wheel-429832.mp3','data/demo-questions.json']){
  assert.equal(fs.existsSync(path.join(root,item)),false,item);
 }
 const screen=read('public/tv/showcase.js');
 assert.doesNotMatch(screen,/goToLobby\('target'\)/);
 assert.match(screen,/goToLobby\('start'\)/);
 const board=read('server/board.js');
 assert.match(board,/phase5\.start\(room, 'tiebreak', now, null\)/);
});
