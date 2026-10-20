'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {GameRooms}=require('../server/rooms');
function fixture(count=4){
 let now=1000;
 const rooms=new GameRooms({now:()=>now,randomInt:()=>0});
 const {code}=rooms.create('tv');
 for(let i=0;i<count;i++){
  rooms.join({code,name:`Contestant ${i+1}`,avatarId:i+1,socketId:`phone${i}`});
  rooms.setReady(code,`phone${i}`,true);
 }
 const state=rooms.startGame(code,'tv');
 return {rooms,code,state,room:rooms.find(code),time:()=>now,advance:ms=>{now+=ms;rooms.sweep();}};
}
test('new rooms default to Everyone Rolls; old style is selectable',()=>{
 const f=fixture();assert.equal(f.state.settings.roundStyle,'everyone');
 assert.equal(f.state.board.step,'round_roll');
 const g=new GameRooms(),created=g.create('tv');
 g.setSettings(created.code,'tv',{roundStyle:'sequential'});
 assert.equal(g.state(created.code).settings.roundStyle,'sequential');
 assert.throws(()=>g.setSettings(created.code,'tv',{roundStyle:'invalid'}),{code:'SETTINGS'});
});
test('all players may roll exactly once, and values are server generated',()=>{
 const f=fixture(4);const a=f.rooms.rollGame(f.code,'phone2');
 assert.equal(a.board.round.rolls[f.room.players[2].id].die,1);
 assert.throws(()=>f.rooms.rollGame(f.code,'phone2'),{code:'ROLLED'});
 assert.throws(()=>f.rooms.rollGame(f.code,'intruder'),{code:'AUTH'});
 for(const i of [0,1,3])f.rooms.rollGame(f.code,`phone${i}`);
 assert.equal(f.room.board.step,'round_moving');
});
test('deadline auto-rolls for missing and disconnected phones and moves one at a time',()=>{
 const f=fixture(4);f.rooms.rollGame(f.code,'phone0');
 f.rooms.disconnect(f.code,'phone2');f.advance(12001);
 assert.equal(f.room.board.round.rolls[f.room.players[2].id].automatic,true);
 assert.equal(f.room.board.step,'round_moving');
 f.advance(901);assert.equal(f.room.board.round.moveIndex,1);
 f.advance(901);assert.equal(f.room.board.round.moveIndex,2);
});
test('Showdown priority rotates and extra contenders receive one Spark',()=>{
 const f=fixture(4),b=f.room.board;
 b.round.stage='moving';b.round.moveIndex=4;
 const locs=[7,15,22,30];
 f.room.players.forEach((p,i)=>p.position=locs[i]);
 b.nextAt=1000;f.advance(1);
 assert.equal(b.round.showdownId,f.room.players[0].id);
 assert.deepEqual(f.room.players.map(p=>p.sparks),[0,1,1,1]);
});
