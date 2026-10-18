"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Arena uses the approved stage image without replacing the real QR code',()=>{
  const html=get('public/tv/index.html');
  assert.match(html,/arena-board\.css/);
  assert.match(html,/id="boardGraphic"/);
  assert.match(html,/id="qrImage"/);
  assert.match(html,/id="welcomeQR"/);
  assert.match(html,/id="scoreboard"/);
  assert.match(html,/id="arenaBottomCue"/);
  assert.ok(fs.statSync(path.join(root,'public/tv/art/board-stage.webp')).size>50_000);
  assert.match(get('public/tv/arena-board.css'),/board-stage\.webp/);
});
test('Live visual board has exactly 36 unique positions, none undefined',()=>{
  const context={window:{}};
  vm.runInNewContext(get('public/tv/board-view.js'),context);
  const view=new context.window.NogginBoardView([],()=>{});
  const ps=view.positions();
  assert.equal(Object.keys(ps).length,36);
  assert.equal(new Set(Object.values(ps).map(([x,y])=>x+','+y)).size,36);
  for(let i=0;i<36;i++){
    assert.ok(ps[i],`missing ${i}`);
    const [x,y]=ps[i];assert.ok(Number.isFinite(x)&&Number.isFinite(y),`bad point ${i}`);
    assert.ok(x>=0&&x<=1600&&y>=0&&y<=580,`off canvas ${i}`);
    const next=ps[(i+1)%36];assert.ok(Math.hypot(next[0]-x,next[1]-y)<165,`broken route ${i}`);
  }
});
test('Players and their Sparks render from live state, not the static drawing',()=>{
  const js=get('public/tv/board-view.js');
  assert.match(js,/state\.players\.forEach/);
  assert.match(js,/p\.sparks/);
  assert.match(js,/this\.data\.forEach/);
  assert.match(js,/this\.paintTokens\(state\.players\)/);
  assert.match(js,/b\.routeOptions/);
});
