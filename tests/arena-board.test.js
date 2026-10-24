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
test('Live visual board: 28 unique trapezium positions, corners on corners, centre hub left clear',()=>{
  const context={window:{}};
  vm.runInNewContext(get('public/tv/board-view.js'),context);
  const view=new context.window.NogginBoardView([],()=>{});
  const ps=view.positions(),layout=require('../server/layout');
  assert.equal(Object.keys(ps).length,layout.SPACES.length);
  assert.equal(new Set(Object.values(ps).map(([x,y])=>x+','+y)).size,28);
  for(let i=0;i<28;i++){
    assert.ok(ps[i],`missing ${i}`);
    const [x,y]=ps[i];assert.ok(Number.isFinite(x)&&Number.isFinite(y),`bad point ${i}`);
    assert.ok(x>=0&&x<=1600&&y>=0&&y<=580,`off canvas ${i}`);
    const next=ps[(i+1)%28],gap=Math.hypot(next[0]-x,next[1]-y);
    assert.ok(gap<165,`broken route ${i}`);assert.ok(gap>=100,`tiles ${i} and ${i+1} overlap`);
  }
  // Trapezium: the top edge is narrower than the bottom edge, and the four
  // Showdown spaces are its four corners.
  const [bl,tl,tr,br]=layout.CORNERS.map(i=>ps[i]);
  assert.ok(tr[0]-tl[0]<br[0]-bl[0]);assert.equal(tl[1],tr[1]);assert.equal(bl[1],br[1]);
  for(const [x,y] of Object.values(ps))assert.ok(x>=bl[0]&&x<=br[0]&&y>=tl[1]&&y<=bl[1]);
  // The central hub (svg y≈185–360, x≈528–1088 at 16:9) never covers a tile or its token.
  for(const [i,[x,y]] of Object.entries(ps)){
    const inside=x>528-40&&x<1088+40&&y-49-23<360&&y+34>185;
    assert.ok(!inside,`space ${i} sits under the centre hub`);
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
