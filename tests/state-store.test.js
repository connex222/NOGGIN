'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const {GameRooms}=require('../server/rooms'),store=require('../server/state-store');
function one(now){const rooms=new GameRooms({now:()=>now,randomInt:()=>0});const {code}=rooms.create('tv1');const tokens=[];for(let n=1;n<=2;n++){const r=rooms.join({code,name:'Person'+n,avatarId:n,socketId:'phone'+n});tokens.push(r.token);rooms.setReady(code,'phone'+n,true);}rooms.startGame(code,'tv1');return {rooms,code,tokens};}
test('single-instance checkpoint saves private reconnect credentials and restores paused game correctly',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'noggin-state-'));const filename=path.join(dir,'state.json');
 try{
  const fixture=one(1000),r=fixture.rooms.find(fixture.code);r.board.deadline=10000;r.board.nextAt=20000;
  assert(store.save(fixture.rooms,filename,1000));const raw=fs.readFileSync(filename,'utf8');assert(raw.includes(fixture.tokens[0]));
  const restored=new GameRooms({now:()=>3000,randomInt:()=>0});assert.equal(store.restore(restored,filename,3000),1);
  const p=restored.find(fixture.code);assert.equal(p.hostSocketId,null);assert.equal(p.board.pausedAt,3000);assert.equal(p.board.deadline,12000);assert.equal(p.board.nextAt,22000);
  assert(p.players.every(x=>!x.socketId&&x.offlineSince===3000));
  restored.resume({code:fixture.code,token:p.hostToken,role:'host',socketId:'tv-resumed'});
  restored.resume({code:fixture.code,token:fixture.tokens[0],role:'player',socketId:'phone-resumed'});
  assert.equal(p.players[0].socketId,'phone-resumed');assert.equal(p.hostSocketId,'tv-resumed');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('checkpoint rejects unknown formats and does not revive stale 24-hour checkpoints',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'noggin-state-'));const filename=path.join(dir,'old.json');
 try{
  assert(store.save(new GameRooms(),filename,1000));assert.equal(store.restore(new GameRooms(),filename,1000+25*60*60*1000),0);
  fs.writeFileSync(filename,JSON.stringify({format:77,savedAt:1000,rooms:[]}));assert.throws(()=>store.restore(new GameRooms(),filename,2000),/format/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
