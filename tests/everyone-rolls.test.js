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
 f.advance(2601);assert.equal(f.room.board.round.moveIndex,1);
 f.advance(2601);assert.equal(f.room.board.round.moveIndex,2);
});
test('Showdown priority rotates and extra contenders receive one Spark',()=>{
 const f=fixture(4),b=f.room.board;
 b.round.stage='moving';b.round.moveIndex=4;
 const locs=[6,10,18,22];
 f.room.players.forEach((p,i)=>p.position=locs[i]);
 b.nextAt=1000;f.advance(1);
 assert.equal(b.round.showdownId,f.room.players[0].id);
 assert.deepEqual(f.room.players.map(p=>p.sparks),[0,1,1,1]);
});

// ───── v3 round loop in Everyone Rolls ─────
const board=require('../server/board');
function rollAll(f,dice){f.room.board.round.stage='rolling';for(const [i,p] of f.room.players.entries()){f.room.board.round.rolls[p.id]={dice:[dice[i]],die:dice[i],automatic:false};}
 f.room.board.deadline=f.time();f.advance(1); // server prepares moves
 for(let i=0;i<f.room.players.length+1;i++)f.advance(2601);}
test('Everyone Rolls: landings call the round game; the last caller in move order hosts it',()=>{
 const f=fixture(3),[a,b,c]=f.room.players;
 a.position=0;b.position=0;c.position=0;
 rollAll(f,[1,2,5]);            // A brain, B speed, C applause
 assert.equal(f.room.board.step,'result');
 assert.equal(f.room.board.roundCategory,'speed');assert.equal(f.room.board.roundCaller,b.id);
 assert.equal(c.sparks,2);assert.match(f.room.board.result.text,/calls SPEED/);
 f.advance(6001);
 assert.equal(f.room.board.stage,'round-game');assert.equal(f.room.board.minigame.category,'speed');assert.equal(f.room.board.activeId,b.id);
});
test('Everyone Rolls: a Wildcard holder picks and locks the game before it starts',()=>{
 const f=fixture(3),[a,b]=f.room.players;
 a.position=13;b.position=0;f.room.players[2].position=0;
 rollAll(f,[1,1,2]);            // A wildcard, B brain, C speed
 assert.equal(f.room.board.step,'result');f.advance(6001);
 assert.equal(f.room.board.step,'choose_category');assert.equal(f.room.board.activeId,a.id);
 f.rooms.chooseGame(f.code,'phone0',{category:'create'});
 assert.equal(f.room.board.roundLocked,true);assert.equal(f.room.board.roundCaller,a.id);
 f.advance(6001);assert.equal(f.room.board.minigame.category,'create');assert.equal(f.room.board.activeId,a.id);
});
test('Everyone Rolls: the Showdown comes after the landings and before the round game; a swap cannot break it',()=>{
 const f=fixture(3),[a,b,c]=f.room.players;
 a.position=5;b.position=12;c.position=0;c.sparks=4;
 rollAll(f,[1,1,1]);            // A corner 6, B swap 13 (swaps with leader C), C brain
 f.advance(6001);
 assert.equal(f.room.board.step,'showdown');assert.equal(f.room.board.showdown.kind,'buzzer');
 assert.deepEqual(f.room.board.showdown.participants,[a.id,c.id]);
});
test('Everyone Rolls: show length, Last Orders and the final verdict',()=>{
 const f=fixture(4);assert.equal(f.room.board.totalRounds,board.autoRounds(4,'everyone'));
 const b=f.room.board;b.roundNo=b.totalRounds;b.stage='round-game';b.turnStartSparks=Object.fromEntries(f.room.players.map(p=>[p.id,0]));
 f.room.players[1].sparks=3;
 board.finishTurn(f.room,f.time(),'Final game',[f.room.players[1].id]);
 assert.equal(f.room.players[1].sparks,(3+board.ROUND_GAME_BONUS)*2);
 f.advance(6001);assert.equal(f.room.phase,'finished');assert.deepEqual(b.winnerIds,[f.room.players[1].id]);
});
test('Everyone Rolls: each token move is paced to its own dice and hop animation',()=>{
 const f=fixture(3);for(const p of f.room.players)f.room.board.round.rolls[p.id]={dice:[4],die:4,automatic:false};
 f.room.board.deadline=f.time();f.advance(1);
 assert.equal(f.room.board.step,'round_moving');const first=f.room.board.nextAt;f.advance(first-f.time());
 assert.equal(f.room.board.round.moveIndex,1);assert.equal(f.room.board.nextAt,f.time()+board.presentMs(4));
});
