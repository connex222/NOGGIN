'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {GameRooms}=require('../server/rooms');
const board=require('../server/board');
const speed=require('../server/games/phase3');
const {attachGateway}=require('../server/gateway');
function setup(){
 let time=20_000;
 const rooms=new GameRooms({now:()=>time,randomInt:()=>0});
 const {code}=rooms.create('tv');
 for(let i=0;i<4;i++){
   rooms.join({code,name:'Player '+(i+1),avatarId:i+1,socketId:'p'+i});
   rooms.setReady(code,'p'+i,true);
 }
 rooms.setSettings(code,'tv',{rules:'showtime'});rooms.startGame(code,'tv');
 return {rooms,code,room:rooms.find(code),now:()=>time,forward:(ms)=>time+=ms};
}

test('manual pause keeps server clocks, Count Flash TV cues and phone clock in sync',()=>{
 const h=setup();speed.start(h.room,'speed',h.now(),()=>0,'count-flash');
 h.forward(4_000);h.rooms.sweep();
 const m=h.room.board.minigame, original={deadline:m.deadline,openAt:m.openAt,cue:m.display.flashEndsAt};
 h.rooms.pauseGame(h.code,'tv');
 assert.equal(h.rooms.state(h.code).board.paused,true);
 h.forward(20_000);h.rooms.sweep();
 assert.equal(m.deadline,original.deadline,'server deadline does not expire while manually paused');
 assert.equal(m.display.flashEndsAt,original.cue);
 assert.equal(h.rooms.state(h.code).board.step,'minigame');
 assert.throws(()=>h.rooms.inputGame(h.code,'p0',12,m.roundKey),{code:'PAUSED'});
 h.rooms.resumeGame(h.code,'tv');
 assert.equal(m.deadline,original.deadline+20_000);
 assert.equal(m.openAt,original.openAt+20_000);
 assert.equal(m.display.flashEndsAt,original.cue+20_000);
 assert.equal(h.rooms.state(h.code).board.paused,false);
});

test('Quick Draw readyAt and Unscramble revealAt shift with pause',()=>{
 for(const [category,id,field] of [['speed','quick-draw','readyAt'],['brain','unscramble','revealAt']]){
   const h=setup();speed.start(h.room,category,h.now(),()=>0,id);
   h.forward(4_000);h.rooms.sweep();
   const m=h.room.board.minigame,orig=m.display[field];
   assert.ok(orig>0);
   h.rooms.pauseGame(h.code,'tv');h.forward(9000);h.rooms.resumeGame(h.code,'tv');
   assert.equal(m.display[field],orig+9000,field+' for '+id);
 }
});

test('host resume, pause and skip permissions are enforced and gameplay stays paused',()=>{
 const h=setup();
 assert.throws(()=>h.rooms.pauseGame(h.code,'p0'),{code:'AUTH'});
 assert.throws(()=>h.rooms.resumeGame(h.code,'tv'),{code:'PHASE'});
 h.rooms.pauseGame(h.code,'tv');
 assert.throws(()=>h.rooms.pauseGame(h.code,'tv'),{code:'PAUSED'});
 h.forward(50_000);h.rooms.sweep();
 assert.equal(h.rooms.state(h.code).board.step,'await_roll');
 assert.throws(()=>h.rooms.skipDisconnectedGame(h.code,'tv'),{code:'ONLINE'});
 h.rooms.resumeGame(h.code,'tv');
 assert.equal(h.rooms.state(h.code).board.step,'await_roll');
});

test('offline player timeout skips only their turn and costs them nothing',()=>{
 const h=setup(),active=h.room.players[0];
 active.sparks=3;
 h.rooms.disconnect(h.code,'p0');h.forward(500);h.rooms.sweep();
 assert.equal(h.rooms.state(h.code).board.paused,true);
 h.forward(30_000);h.rooms.sweep();
 assert.equal(h.room.board.step,'result');
 assert.equal(h.room.board.minigame,null);
 assert.equal(active.sparks,3);
 h.forward(3_000);h.rooms.sweep();
 assert.equal(h.room.board.step,'await_roll');
 assert.notEqual(h.room.board.activeId,active.id);
});

test('showrunner can skip an offline active contestant immediately, but not an online contestant',()=>{
 const h=setup();
 assert.throws(()=>h.rooms.skipDisconnectedGame(h.code,'tv'),{code:'ONLINE'});
 h.rooms.disconnect(h.code,'p0');h.rooms.skipDisconnectedGame(h.code,'tv');
 assert.equal(h.room.board.step,'result');
 assert.match(h.room.board.result.text,/turn was skipped/);
 assert.throws(()=>h.rooms.skipDisconnectedGame(h.code,'p1'),{code:'AUTH'});
});

test('manual pause does not consume an offline player’s 30 second reconnection grace',()=>{
 const h=setup();
 h.rooms.pauseGame(h.code,'tv');
 h.rooms.disconnect(h.code,'p0');h.forward(50_000);h.rooms.sweep();
 assert.equal(h.room.board.step,'await_roll');
 h.rooms.resumeGame(h.code,'tv');
 h.rooms.sweep();assert.equal(h.room.board.step,'await_roll');
 h.forward(29_000);h.rooms.sweep();assert.equal(h.room.board.step,'await_roll');
 h.forward(1000);h.rooms.sweep();assert.equal(h.room.board.step,'result');
});

class Socket{
 constructor(id){this.id=id;this.events={};this.out=[];this.handshake={address:'192.168.1.2'};this.request={headers:{host:'localhost:3000'},secure:false};this.request.socket={remoteAddress:'192.168.1.2'};}
 on(event,fn){this.events[event]=fn;}join(){}leave(){}emit(name,payload){this.out.push({name,payload});}
 send(event,payload={}){return new Promise(done=>this.events[event](payload,done));}
}
class IO{
 constructor(){this.connections=null;this.sockets={sockets:new Map()};this.out=[];}
 on(_event,fn){this.connections=fn;}
 connect(id){const s=new Socket(id);this.sockets.sockets.set(id,s);this.connections(s);return s;}
 to(id){return {emit:(name,value)=>this.out.push({id,name,value})};}
 in(){return {socketsLeave(){}};}
}

test('failed host QR regeneration cannot hijack or orphan the existing TV session',async()=>{
 let broken=false;
 const io=new IO();const gw=attachGateway(io,{QRCode:{toDataURL:async()=>{if(broken)throw Error('image encoder crashed');return 'data:image/png;base64,GOOD';}}});
 try{
   const tv=io.connect('tv'),created=await tv.send('room:create');
   assert.equal(created.ok,true);
   const replacement=io.connect('replacement');broken=true;
   const failed=await replacement.send('room:resume',{code:created.code,token:created.token,role:'host'});
   assert.equal(failed.ok,false);
   assert.equal(gw.rooms.find(created.code).hostSocketId,'tv');
   assert.equal((await tv.send('room:settings',{patch:{rounds:10}})).ok,true);
   assert.equal(tv.out.some(x=>x.name==='room:session-replaced'),false);
   broken=false;
   assert.equal((await replacement.send('room:resume',{code:created.code,token:created.token,role:'host'})).ok,true);
   assert.equal(gw.rooms.find(created.code).hostSocketId,'replacement');
   assert.equal(tv.out.some(x=>x.name==='room:session-replaced'),true);
 }finally{gw.stop();}
});

test('host pause/resume/skip socket events require host binding and broadcast new state',async()=>{
 const io=new IO(),gw=attachGateway(io,{QRCode:{toDataURL:async()=> 'data:image/png;base64,GOOD'}});
 try{
   const tv=io.connect('tv'),created=await tv.send('room:create');
   const p1=io.connect('p1'),p2=io.connect('p2');
   for(const [p,n,i] of [[p1,'Amy',1],[p2,'Ben',2]]){
      assert.equal((await p.send('room:join',{code:created.code,name:n,avatarId:i})).ok,true);
      assert.equal((await p.send('room:ready',{ready:true})).ok,true);
   }
   assert.equal((await tv.send('game:start')).ok,true);
   assert.equal((await p1.send('game:pause')).code,'AUTH');
   assert.equal((await tv.send('game:pause')).state.board.paused,true);
   assert.equal((await p1.send('game:roll')).code,'PAUSED');
   assert.equal((await tv.send('game:resume')).state.board.paused,false);
   assert.equal((await tv.send('game:skip-offline')).code,'ONLINE');
   assert.ok(io.out.filter(e=>e.name==='room:state').length>0);
 }finally{gw.stop();}
});


test('saved manual pause survives restart; animation clocks and session tokens remain consistent',()=>{
 const store=require('../server/state-store');
 const os=require('node:os'),fs=require('node:fs'),path=require('node:path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'noggin-v11-'));
 try{
   const h=setup();speed.start(h.room,'speed',h.now(),()=>0,'quick-draw');
   h.forward(4_000);h.rooms.sweep();h.rooms.pauseGame(h.code,'tv');
   const at=h.room.board.minigame.display.readyAt,saveTime=h.now();
   const filename=path.join(dir,'rooms.json');store.save(h.rooms,filename,saveTime);
   const recovered=new GameRooms({now:()=>saveTime+24_000,randomInt:()=>0});
   assert.equal(store.restore(recovered,filename,saveTime+24_000),1);
   const r=recovered.find(h.code);
   assert.equal(r.board.pauseKind,'manual');
   assert.equal(r.board.minigame.display.readyAt,at+24_000);
   assert.equal(r.hostSocketId,null);
   recovered.resume({code:h.code,token:r.hostToken,socketId:'new-tv',role:'host'});
   recovered.sweep();assert.equal(recovered.state(h.code).board.paused,true);
   recovered.resumeGame(h.code,'new-tv');
   assert.equal(recovered.state(h.code).board.paused,false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('skipping an interrupted contested mini-game voids an eligible Headline Bet',()=>{
 const h=setup();const active=h.room.players[0];active.sparks=5;
 speed.start(h.room,'speed',h.now(),()=>0,'quick-draw');
 h.room.board.headline=true;h.room.board.headlineEligible=true;
 h.rooms.disconnect(h.code,'p0');h.rooms.skipDisconnectedGame(h.code,'tv');
 assert.equal(active.sparks,5,'disconnection must not count as losing the wager');
 assert.equal(h.room.board.minigame,null);
 assert.equal(h.room.board.step,'result');
 assert.deepEqual(h.room.board.result.winners,[]);
});
