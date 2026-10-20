'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {GameRooms}=require('./helpers/sequential-rooms');
const board=require('../server/board');
const phase3=require('../server/games/phase3');
function fixture(n=3){
 let now=10000,queue=[],rooms=new GameRooms({now:()=>now,randomInt:max=>(queue.length?queue.shift():0)%max});
 const {code}=rooms.create('tv');for(let i=0;i<n;i++){rooms.join({code,name:`Player ${i+1}`,avatarId:i+1,socketId:`p${i}`});rooms.setReady(code,`p${i}`,true);}rooms.setSettings(code,'tv',{rules:'showtime'});rooms.startGame(code,'tv');
 return {rooms,code,room:rooms.find(code),time:()=>now,set:t=>{now=t},advance:d=>{now+=d},dice:(...nums)=>queue.push(...nums),sock:i=>`p${i}`};
}
test('Director Cues are limited, opt-in, and absent from hidden-room tokens',()=>{
 const f=fixture();assert.equal(f.room.players[0].cues,2);assert.equal(f.room.board.routePlan,false);
 assert(!JSON.stringify(f.rooms.state(f.code)).includes(f.room.players[0].token));
 f.rooms.chooseGame(f.code,f.sock(0),{action:'director'});
 assert.equal(f.room.board.routePlan,true);assert.equal(f.room.players[0].cues,2);
 f.dice(3);f.rooms.rollGame(f.code,f.sock(0));
 assert.equal(f.room.board.step,'choose_route');
 assert.deepEqual(f.room.board.routeOptions.map(o=>o.steps),[4,3,5]);
 assert.equal(f.room.players[0].position,0);
 assert.throws(()=>f.rooms.chooseGame(f.code,f.sock(1),{option:0}),e=>e.code==='TURN');
 assert.throws(()=>f.rooms.chooseGame(f.code,f.sock(0),{option:99}),e=>e.code==='ROUTE');
 f.rooms.chooseGame(f.code,f.sock(0),{option:2});
 assert.equal(f.room.players[0].position,5);assert.equal(f.room.players[0].cues,1);
 assert.equal(f.room.board.step,'minigame');
 assert.throws(()=>f.rooms.chooseGame(f.code,f.sock(0),{option:1}),e=>e.code==='STEP');
});
test('Normal rolls stay immediate and free; cancelling a plan does not spend anything',()=>{
 const f=fixture(2);f.rooms.chooseGame(f.code,f.sock(0),{action:'director'});
 f.rooms.chooseGame(f.code,f.sock(0),{action:'normal'});
 assert.equal(f.room.board.routePlan,false);f.dice(2);f.rooms.rollGame(f.code,f.sock(0));
 assert.equal(f.room.players[0].position,3);assert.equal(f.room.players[0].cues,2);
 assert.equal(f.room.board.step,'choose_target');
});
test('Automatic route selection picks free original roll on expiry',()=>{
 const f=fixture(2);f.rooms.chooseGame(f.code,f.sock(0),{action:'director'});
 f.dice(1);f.rooms.rollGame(f.code,f.sock(0));
 assert.equal(f.room.board.step,'choose_route');const deadline=f.room.board.deadline;
 f.set(deadline+1);f.rooms.sweep();
 assert.equal(f.room.players[0].position,2);assert.equal(f.room.players[0].cues,2);
 assert.notEqual(f.room.board.step,'choose_route');
});
test('Two-dice trailing player gets all valid route choices; zero and seven steps excluded',()=>{
 const f=fixture(2);f.room.players[1].sparks=4;
 f.rooms.chooseGame(f.code,f.sock(0),{action:'director'});f.dice(0,5);f.rooms.rollGame(f.code,f.sock(0));
 const opts=f.room.board.routeOptions;
 assert.deepEqual([...new Set(opts.map(o=>o.steps))].sort((a,b)=>a-b),[1,2,5,6]);
 const five=opts.findIndex(o=>o.steps===5);f.rooms.chooseGame(f.code,f.sock(0),{option:five});
 assert.equal(f.room.players[0].position,5);assert.equal(f.room.players[0].cues,1);
});
test('Crossing Start refreshes only one Cue and never exceeds the two-Cue cap',()=>{
 const f=fixture(2);f.room.players[0].position=34;f.room.players[0].cues=0;
 f.dice(2);f.rooms.rollGame(f.code,f.sock(0));
 assert.equal(f.room.players[0].position,1);assert.equal(f.room.players[0].cues,1);
 const g=fixture(2);g.room.players[0].position=35;g.dice(0);g.rooms.rollGame(g.code,g.sock(0));
 assert.equal(g.room.players[0].cues,2);
});
test('No player can enable Director mode with zero Cues',()=>{
 const f=fixture(2);f.room.players[0].cues=0;
 assert.throws(()=>f.rooms.chooseGame(f.code,f.sock(0),{action:'director'}),e=>e.code==='CUES');
 assert.equal(f.room.board.step,'await_roll');
});
test('Target counting: progressive Showtime object count never leaks the answer to phones',()=>{
 const f=fixture(2);phase3.start(f.room,'speed',f.time(),()=>0,'count-flash');
 const m=f.room.board.minigame;assert(m.secret.count>=1&&m.secret.count<=18);
 assert.equal(m.privateTv.total,12);assert.notEqual(m.privateTv.icon,m.privateTv.distractor);
 const dto=f.rooms.state(f.code).board.minigame;
 assert.equal(dto.tvCue,undefined);assert(!JSON.stringify(dto).includes('"count":'));
 assert.equal(f.rooms.state(f.code,true).board.minigame.tvCue.count,m.secret.count);
});
test('Higher or Lower: second wrong answer eliminates, first never eliminates',()=>{
 const f=fixture(3);phase3.start(f.room,'brain',f.time(),()=>0,'higher-lower');
 let m=f.room.board.minigame;m.phase='play';m.introUntil=undefined;
 const id=f.room.players[0].id;
 f.rooms.inputGame(f.code,f.sock(0),1-m.secret.answer,m.roundKey);
 f.set(m.deadline+1);f.rooms.sweep();assert.equal(m.strikes[id],1);assert(!m.eliminated.includes(id));
 f.set(m.deadline+1);f.rooms.sweep(); // reveal transition to next round
 if(f.room.board.step==='minigame'){
  m=f.room.board.minigame;f.rooms.inputGame(f.code,f.sock(0),1-m.secret.answer,m.roundKey);
  f.set(m.deadline+1);f.rooms.sweep();assert.equal(m.strikes[id],2);assert(m.eliminated.includes(id));
 }
});
