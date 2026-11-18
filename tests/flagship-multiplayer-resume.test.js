'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {GameRooms}=require('../server/rooms');
function studio(playerCount=4){
 let clock=10000;
 // deterministic sequence is for room code and game path; no client owns dice outcomes
 const rooms=new GameRooms({now:()=>clock,randomInt:()=>0});
 const created=rooms.create('tv-original');
 const sessions=[];
 for(let i=1;i<=playerCount;i++){
  const socketId='phone-'+i;
  const p=rooms.join({code:created.code,name:'Guest '+i,avatarId:i,socketId});
  rooms.setReady(created.code,socketId,true);
  sessions.push({...p,socketId,seat:i});
 }
 rooms.startGame(created.code,'tv-original');
 return {rooms,created,sessions,now:()=>clock,advance:ms=>clock+=ms};
}
for(const size of [2,4,8]){
 test(size+' phones: simultaneous game start has stable unique seats',()=>{
  const f=studio(size);
  const state=f.rooms.state(f.created.code,true);
  assert.equal(state.players.length,size);
  assert.deepEqual(state.players.map(p=>p.seat),Array.from({length:size},(_,i)=>i+1));
  assert.equal(new Set(state.players.map(p=>p.id)).size,size);
  assert.equal(state.phase,'board');
  assert.throws(()=>f.rooms.join({code:f.created.code,name:'Late Guest',avatarId:12,socketId:'new'}),e=>e.code==='PHASE');
 });
}
test('host browser reconnect preserves the same board clock and player seats',()=>{
 const f=studio(4);
 const original=f.rooms.find(f.created.code);
 const initial=original.board.deadline;
 const ids=original.players.map(p=>p.id);
 f.rooms.disconnect(f.created.code,'tv-original');
 assert.equal(original.board.pauseKind,'host');
 f.advance(5500);
 const resumed=f.rooms.resume({code:f.created.code,token:f.created.token,role:'host',socketId:'tv-reconnected'});
 assert.equal(resumed.state.hostOnline,true);
 f.rooms.sweep();
 assert.deepEqual(original.players.map(p=>p.id),ids);
 assert.equal(original.board.pausedAt,null);
 assert.equal(original.board.deadline,initial+5500);
});
test('phone drops and returns in-game to original seat and avatar without creating a new player',()=>{
 const f=studio(4);
 const before=f.rooms.state(f.created.code);
 const chosen=f.sessions[1];
 f.rooms.disconnect(f.created.code,chosen.socketId);
 assert.equal(f.rooms.state(f.created.code).players[1].online,false);
 f.advance(8500);
 const resumed=f.rooms.resume({code:f.created.code,token:chosen.token,role:'player',socketId:'phone-new'});
 assert.equal(resumed.playerId,chosen.playerId);
 const after=f.rooms.state(f.created.code);
 assert.equal(after.players.length,4);
 assert.deepEqual(after.players.map(p=>p.id),before.players.map(p=>p.id));
 assert.equal(after.players[1].avatarId,before.players[1].avatarId);
 assert.equal(after.players[1].online,true);
});

test('TV can return to the same room lobby without losing seats or leaving old clocks live',()=>{
 const f=studio(4), room=f.rooms.find(f.created.code);
 assert.equal(room.phase,'board');
 assert.throws(()=>f.rooms.backToLobby(f.created.code,'unrelated-phone'),e=>e.code==='AUTH');
 assert.equal(room.phase,'board','Unauthorised phones cannot reset the game');
 const lobby=f.rooms.backToLobby(f.created.code,'tv-original');
 assert.equal(lobby.phase,'lobby');
 assert.equal(lobby.code,f.created.code);
 assert.equal(lobby.players.length,4);
 assert.equal(room.board,null);
 assert.equal(room.matchReport,null);
 assert.ok(room.players.every(p=>!p.ready&&p.sparks===0&&p.cues===0));
 for(const s of f.sessions)f.rooms.setReady(f.created.code,s.socketId,true);
 const resumed=f.rooms.startGame(f.created.code,'tv-original');
 assert.equal(resumed.phase,'board');
 assert.equal(resumed.players.length,4,'A new show preserves the original four seats');
});
