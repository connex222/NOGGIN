'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/tv/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'public/tv/showcase.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/tv/showcase.css'),'utf8');
test('two real screen backdrops and dynamic cast data are bundled',()=>{
 for(const p of ['welcome-stage.webp','lobby-stage.webp'])assert.ok(fs.existsSync(path.join(root,'public/tv/art',p)));
 assert.match(html,/id="welcomeScreen"/);assert.match(html,/id="lobbyCast"/);
 assert.match(js,/Math.random\(\)/);assert.match(js,/a.images\[expression\]/);
});
test('real QR, join URL and live room code are bound to the existing TV engine',()=>{
 for(const id of ['roomCode','joinUrl','qrImage','welcomeQR','welcomeRoomCode','stageReady','rounds','timerSpeed','roster'])
   assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.match(js,/getAttribute\('src'\)/);assert.match(js,/MutationObserver/);
 assert.ok(!html.includes('7K3M9'));assert.ok(!html.includes('noggin.game'));
});
test('welcome buttons are keyboard accessible and game-stage elements preserved',()=>{
 for(const id of ['welcomeStart','welcomeJoin','welcomeHowTo','welcomeRulesPlay','showPause','showReport','gameStage','boardGraphic'])
 assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(css,/welcome-hit-start/);assert.match(css,/welcome-hit-join/);assert.match(css,/welcome-hit-rules/);
});
