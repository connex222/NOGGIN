'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {GameRooms}=require('./helpers/sequential-rooms');
const speed=require('../server/games/phase3');
const social=require('../server/games/phase4');
function setup(mode){
 const now=100000,rooms=new GameRooms({now:()=>now,randomInt:()=>0});
 const {code}=rooms.create('tv');
 rooms.setSettings(code,'tv',{rules:mode});
 for(let i=0;i<4;i++){
  rooms.join({code,name:`Guest ${i}`,avatarId:i+1,socketId:`p${i}`});
  rooms.setReady(code,`p${i}`,true);
 }
 rooms.startGame(code,'tv');
 return {room:rooms.find(code),now};
}
test('Showtime increases short-form mini-games to five stages without changing Classic',()=>{
 for(const game of ['quick-draw','count-flash','close-call','unscramble']){
  const basic=setup('classic');speed.start(basic.room,speed.SPECS[game].category,basic.now,()=>0,game);
  assert.equal(speed.publicState(basic.room).totalRounds,3,game);
  const show=setup('showtime');speed.start(show.room,speed.SPECS[game].category,show.now,()=>0,game);
  assert.equal(speed.publicState(show.room).totalRounds,5,game);
 }
});
test('Server decreases Quick Draw response time by the fifth stage',()=>{
 const {room,now}=setup('showtime');speed.start(room,'speed',now,()=>0,'quick-draw');
 const m=room.board.minigame;
 const first=m.deadline-m.openAt;
 m.round=4;speed.nextRound(room,now,()=>0);
 assert(m.deadline-m.openAt<first);
 assert.equal(m.display.difficulty,5);
});
test('Showtime social games show five attempts; Classic still shows three',()=>{
 for(const name of ['majority-rules','mind-meld']){
  for(const mode of ['classic','showtime']){
   const {room,now}=setup(mode);
   social.start(room,'together',now,()=>0,name);
   assert.equal(room.board.minigame.totalRounds,mode==='showtime'?5:3);
  }
 }
});
test('Showtime Memory Lane has five increasingly long sequences and a reverse finale',()=>{
 const {room,now}=setup('showtime');speed.start(room,'brain',now,()=>0,'memory-lane');
 const m=room.board.minigame;const lengths=[m.secret.sequence.length];
 for(let n=2;n<=5;n++){speed.nextRound(room,now,()=>0);lengths.push(m.secret.sequence.length)}
 assert.deepEqual(lengths,[2,3,4,5,6]);
 assert.equal(speed.publicState(room).totalRounds,5);
 assert.equal(m.display.reverse,true);
});

test('Showtime Count Flash increases actual puzzle density through all five stages',()=>{
 const {room,now}=setup('showtime');speed.start(room,'speed',now,()=>0,'count-flash');
 const m=room.board.minigame;const totals=[m.privateTv.total];
 for(let n=2;n<=5;n++){speed.nextRound(room,now,()=>0);totals.push(m.privateTv.total);
  assert.equal(m.privateTv.counts.reduce((a,b)=>a+b,0),m.privateTv.total);
  assert.equal(m.secret.count,m.privateTv.counts[m.privateTv.icons.indexOf(m.secret.targetIcon)]);
  assert.equal(speed.publicState(room).tvCue,undefined);
 }
 assert.deepEqual(totals,[12,18,24,30,36]);
});
test('Classic Count Flash retains 36 objects for every round',()=>{
 const {room,now}=setup('classic');speed.start(room,'speed',now,()=>0,'count-flash');
 for(let n=1;n<=3;n++){assert.equal(room.board.minigame.privateTv.total,36);if(n<3)speed.nextRound(room,now,()=>0)}
});

test('Showtime Unscramble selects longer words as difficulty rises',()=>{
 const {room,now}=setup('showtime');speed.start(room,'brain',now,()=>0,'unscramble');
 const m=room.board.minigame;const lengths=[m.secret.answer.length];
 for(let n=2;n<=5;n++){speed.nextRound(room,now,()=>0);lengths.push(m.secret.answer.length)}
 assert(lengths[4]>lengths[0],`Expected longer final word, got ${lengths}`);
 assert.equal(speed.publicState(room).totalRounds,5);
});
