'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {GameRooms}=require('../server/rooms');

function make(count,rounds=6){
 let now=1_000;
 const rooms=new GameRooms({now:()=>now,randomInt:()=>0});
 const {code}=rooms.create('tv');
 for(let i=1;i<=count;i++){
  const socketId='p'+i;
  rooms.join({code,name:'Guest '+i,avatarId:i,socketId});
  rooms.setReady(code,socketId,true);
 }
 rooms.setSettings(code,'tv',{rounds,roundStyle:'everyone',timerSpeed:'normal'});
 rooms.startGame(code,'tv');
 return {rooms,code,room:rooms.find(code),advance:ms=>{now+=ms;rooms.sweep();},now:()=>now};
}

test('Everyone Rolls auto-fills absent phones and advances its round rather than waiting forever',()=>{
 const f=make(4);
 assert.equal(f.room.board.step,'round_roll');
 f.rooms.rollGame(f.code,'p1');
 f.advance(12_010);
 assert.equal(f.room.board.step,'round_moving');
 assert.equal(Object.keys(f.room.board.round.rolls).length,4);
 assert.equal(f.room.board.round.rolls[f.room.players[0].id].automatic,false);
 for(const player of f.room.players.slice(1))
   assert.equal(f.room.board.round.rolls[player.id].automatic,true);
});

test('Last Orders starts with a deliberate standings sting before rolling and no extra score',()=>{
 const f=make(4,6);
 const b=f.room.board;
 const base=f.now();
 b.roundNo=b.totalRounds;
 const before=f.room.players.map(p=>p.sparks);
 require('../server/board').beginRound(f.room,base);
 assert.equal(b.step,'round_roll');
 assert.equal(b.standings.until,base+4_000);
 assert.equal(b.deadline,base+16_000);
 assert.deepEqual(f.room.players.map(p=>p.sparks),before);
 assert.equal(b.standings.ranks.length,4);
});

test('shared roll pauses remain server-owned across a host Wi-Fi interruption',()=>{
 const f=make(4);
 const original=f.room.board.deadline;
 f.advance(4_000);
 f.rooms.disconnect(f.code,'tv');
 f.advance(9_000);
 assert.equal(f.room.board.step,'round_roll');
 f.rooms.resume({code:f.code,token:f.room.hostToken,role:'host',socketId:'tv-new'});
 f.rooms.sweep();
 assert.equal(f.room.board.deadline,original+9_000);
 f.advance(8_010);
 assert.equal(f.room.board.step,'round_moving');
});
