'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {GameRooms}=require('../server/rooms');
const {attachGateway}=require('../server/gateway');
const store=require('../server/state-store');
class FakeSocket {
  constructor(id){this.id=id;this.listeners=new Map();this.messages=[];this.handshake={address:'192.168.200.12',headers:{}};this.request={headers:{host:'localhost:3000'},secure:false,socket:{remoteAddress:'192.168.200.12'}};}
  on(name,fn){this.listeners.set(name,fn);}
  join(){}leave(){}
  emit(name,payload){this.messages.push([name,payload]);}
  send(name,payload={}){const fn=this.listeners.get(name);assert(fn,`Missing gateway event ${name}`);return new Promise(resolve=>fn(payload,resolve));}
  disconnect(){this.listeners.get('disconnect')();}
}
class FakeIO {
  constructor(){this.listener=null;this.sockets={sockets:new Map()};this.broadcasts=[];}
  on(name,fn){if(name==='connection')this.listener=fn;}
  connect(id){const s=new FakeSocket(id);this.sockets.sockets.set(id,s);this.listener(s);return s;}
  to(id){return {emit:(name,payload)=>this.broadcasts.push({id,name,payload})};}
  in(){return {socketsLeave(){}};}
}
function harness(){let clock=100_000;const now=()=>clock;const rooms=new GameRooms({now,randomInt:()=>0}),io=new FakeIO();const gateway=attachGateway(io,{rooms,QRCode:{toDataURL:async()=> 'data:image/png;base64,FAKE'}});return {io,rooms,gateway,advance:(ms)=>{clock+=ms;rooms.sweep();},now};}
async function four(h){
 const host=h.io.connect('tv'),created=await host.send('room:create');assert.equal(created.ok,true);
 const players=[],tokens=[];
 for(let i=0;i<4;i++){
  const socket=h.io.connect(`phone${i}`),joined=await socket.send('room:join',{code:created.code,name:`Contestant ${i+1}`,avatarId:i+1});
  assert.equal(joined.ok,true);assert.equal((await socket.send('room:ready',{ready:true})).ok,true);
  players.push(socket);tokens.push(joined.token);
 }
 return {host,created,players,tokens};
}
test('four phones + TV: entire gateway rehearsal includes round, pauses, skipped phone, match report and privacy',async()=>{
 const h=harness();try{
 const {host,created,players}=await four(h),code=created.code;
 assert.equal((await host.send('game:start')).ok,true);
 const anon=h.io.connect('anon');
 const peek=await anon.send('room:peek',{code});assert.equal(peek.ok,false);assert.equal(peek.code,'PHASE');
 const denied=await players[1].send('game:report');assert.equal(denied.code,'AUTH');
 assert.equal((await players[0].send('game:roll')).ok,true);
 assert.equal(h.rooms.find(code).board.step,'minigame');
 assert.equal((await host.send('game:pause')).ok,true);
 h.advance(20_000);
 assert.equal(h.rooms.find(code).board.step,'minigame');
 assert.equal((await host.send('game:resume')).ok,true);
 // Timeout the intro and then the actual challenge, then advance the result card.
 h.advance(4_000);h.advance(70_000);
 assert.equal(h.rooms.find(code).board.step,'result');
 h.advance(4_000);assert.equal(h.rooms.find(code).board.step,'await_roll');
 assert.equal(h.rooms.find(code).board.activeId,h.rooms.find(code).players[1].id);
 // A player loses Wi-Fi mid-turn, then uses a valid token to resume.
 players[1].disconnect();h.advance(2_000);
 assert.equal(h.rooms.find(code).board.pausedAt!==null,true);
 const restored=h.io.connect('phone1-resumed'),resume=await restored.send('room:resume',{code,token:h.rooms.find(code).players[1].token,role:'player'});
 assert.equal(resume.ok,true);
 h.advance(1000);assert.equal(h.rooms.find(code).board.pausedAt,null);
 // Later the same player disconnects again and the TV skips them.
 restored.disconnect();h.advance(1000);
 const skipped=await host.send('game:skip-offline');assert.equal(skipped.ok,true);
 const out=(await host.send('game:report')).report;
 assert.equal(out.schema,'noggin.match-report.v1');assert.equal(out.playerCount,4);
 assert.equal(out.miniGames['sketch-sabotage'],1);
 assert.ok(out.pausedSeconds>=20);assert.ok(out.skippedDisconnectedTurns>=1);
 assert.ok(out.outcomes===undefined);assert.ok(out.resultsShown>=2);
 assert.equal(JSON.stringify(out).includes(created.token),false);
 assert.equal(JSON.stringify(out).includes('Contestant'),false);
 assert.ok(out.wallTimeSeconds>out.activeSeconds);
 }finally{h.gateway.stop();}
});
test('existing socket cannot silently change player role using a host token',async()=>{
 const h=harness();try{
  const {created,players}=await four(h);
  const r=await players[0].send('room:resume',{code:created.code,token:created.token,role:'host'});
  assert.equal(r.ok,false);assert.equal(r.code,'AUTH');
  assert.equal(h.rooms.find(created.code).hostSocketId,'tv');
  assert.equal(h.rooms.find(created.code).players[0].socketId,'phone0');
  assert.equal((await players[0].send('room:ready',{ready:true})).ok,true);
 }finally{h.gateway.stop();}
});
test('room reports stop counting active time across offline checkpoint restoration',()=>{
 let t=1_000;const rooms=new GameRooms({now:()=>t,randomInt:()=>0});
 const {code}=rooms.create('tv');for(let i=0;i<2;i++){rooms.join({code,name:`Test ${i}`,socketId:`p${i}`,avatarId:i+1});rooms.setReady(code,`p${i}`,true);}
 rooms.startGame(code,'tv');t+=5_000;rooms.state(code);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'noggin-rehearsal-'));const f=path.join(dir,'state.json');
 try{
  store.save(rooms,f,t);
  const replacement=new GameRooms({now:()=>t+60_000,randomInt:()=>0});
  assert.equal(store.restore(replacement,f,t+60_000),1);
  assert.equal(replacement.find(code).matchReport.lastPaused,true);
  const p=replacement.find(code);replacement.resume({code,role:'host',socketId:'new-tv',token:p.hostToken});
  const report=replacement.getMatchReport(code,'new-tv');
  assert.equal(report.activeSeconds,5);assert.equal(report.pausedSeconds,0);
  assert.ok(report.wallTimeSeconds>=65);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('eight players behind one router can join and host-only state never leaks private sketch clues',async()=>{
 const h=harness();try{
  const host=h.io.connect('family-tv'),created=await host.send('room:create');assert.equal(created.ok,true);
  const mobiles=[];
  for(let n=1;n<=8;n++){
   const phone=h.io.connect('shared-router-'+n);
   const joined=await phone.send('room:join',{code:created.code,name:'Family '+n,avatarId:n});
   assert.equal(joined.ok,true);
   assert.equal((await phone.send('room:ready',{ready:true})).ok,true);
   mobiles.push(phone);
  }
  assert.equal((await host.send('game:start')).ok,true);
  assert.equal((await mobiles[0].send('game:roll')).ok,true);
  const board=h.rooms.find(created.code).board;
  assert.equal(board.minigame.id,'sketch-sabotage');
  const hostState=h.rooms.state(created.code,true);
  const artist=h.rooms.state(created.code,false,board.activeId);
  const spectator=h.rooms.state(created.code,false,h.rooms.find(created.code).players[7].id);
  assert(artist.board.minigame.private.word);
  assert.equal(hostState.board.minigame.private,undefined);
  assert.equal(spectator.board.minigame.private?.word,undefined);
  assert.equal(JSON.stringify(spectator).includes(board.minigame.secret.word),false);
  for(const evt of h.io.broadcasts){
   if(evt.name!=='room:state')continue;
   assert.equal(JSON.stringify(evt.payload).includes(created.token),false);
  }
 }finally{h.gateway.stop();}
});
test('deterministic dice and minigame selection obey injected source across turns',()=>{
 let t=1000;const rooms=new GameRooms({now:()=>t,randomInt:()=>0});const {code}=rooms.create('tv');
 for(let n=0;n<3;n++){rooms.join({code,name:'Player '+n,socketId:'p'+n,avatarId:n+1});rooms.setReady(code,'p'+n,true);}
 rooms.startGame(code,'tv');rooms.rollGame(code,'p0');
 assert.equal(rooms.find(code).board.minigame.id,'sketch-sabotage');
 assert.equal(rooms.find(code).players[0].position,1);
});
