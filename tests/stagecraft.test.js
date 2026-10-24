'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {GameRooms}=require('./helpers/sequential-rooms');
const board=require('../server/board');
const phase3=require('../server/games/phase3');
function fixture(){
 let now=30000,queue=[];const rooms=new GameRooms({now:()=>now,randomInt:n=>queue.length?queue.shift()%n:0});
 const {code}=rooms.create('tv');for(let i=0;i<3;i++){rooms.join({code,name:'Contestant '+(i+1),avatarId:i+1,socketId:'p'+i});rooms.setReady(code,'p'+i,true);}
 rooms.setSettings(code,'tv',{rules:'showtime'});rooms.startGame(code,'tv');return {room:rooms.find(code),rooms,code,now:()=>now,advance:ms=>now+=ms,dice:(...d)=>queue.push(...d)};
}
test('Headline Bet has been retired: crafted requests are refused and state no longer carries it',()=>{
 const f=fixture();f.room.players[0].sparks=3;
 for(const action of ['headline','safe'])assert.throws(()=>f.rooms.chooseGame(f.code,'p0',{action}),e=>e.code==='STEP');
 assert.equal(Object.hasOwn(f.rooms.state(f.code).board,'headline'),false);
});
test('Director Cues come from contests (round games, Showdowns), never from passive spaces',()=>{
 const f=fixture();const p=f.room.players[0];p.cues=0;
 f.dice(4);f.rooms.rollGame(f.code,'p0');   // Applause: a free +2, not a contest
 assert.equal(p.sparks,2);assert.equal(p.cues,0);
 const g=fixture();g.room.board.stage='round-game';const w=g.room.players[1];w.cues=0;
 board.finishTurn(g.room,g.now(),'Round played',[w.id]);
 assert.equal(w.cues,1);assert.match(g.room.board.result.text,/Director Cue earned/);
});
test('Wildcard decision timeout still picks, locks and hosts a category',()=>{
 const f=fixture();f.room.players[0].position=13;f.dice(0);f.rooms.rollGame(f.code,'p0');
 assert.equal(f.room.board.step,'choose_category');
 f.advance(12_001);f.rooms.sweep();
 assert.equal(f.room.board.step,'result');assert.equal(f.room.board.roundLocked,true);
 assert.equal(f.room.board.roundCaller,f.room.players[0].id);assert.ok(board.CATEGORIES.includes(f.room.board.roundCategory));
});
test('Director Cue replenishment is capped and works for non-host winners',()=>{
 const f=fixture(),[host,guest]=f.room.players;host.cues=2;guest.cues=1;f.room.board.stage='round-game';
 board.finishTurn(f.room,f.now(),'Guest wins',[guest.id]);
 assert.equal(host.cues,2);assert.equal(guest.cues,2);
 assert.match(f.room.board.result.text,/Director Cue earned/);
});
test('Count Flash hides the requested type until after all three types are shown',()=>{
 const f=fixture();phase3.start(f.room,'speed',f.now(),()=>0,'count-flash');
 const m=f.room.board.minigame;
 assert.equal(m.display.targetIcon,null);assert.equal(m.privateTv.icons.length,3);
 assert.equal(m.privateTv.counts.reduce((a,b)=>a+b,0),12);
 assert(m.privateTv.counts.every(n=>n===4));
 assert.equal(m.secret.count,m.privateTv.counts[m.privateTv.icons.indexOf(m.secret.targetIcon)]);
 const phone=phase3.publicState(f.room,false);
 assert.equal(phone.tvCue,undefined);assert.equal(phone.display.targetIcon,null);
 assert(!Object.hasOwn(phone,'secret'));
 assert.equal(phase3.publicState(f.room,true).tvCue.icons.length,3);
 phase3.tick(f.room,m.openAt,board.finishTurn,()=>0);
 assert.equal(m.phase,'play');assert.equal(m.display.targetIcon,m.secret.targetIcon);
 assert.match(m.question,/How many/);
});
test('Memory Lane Showtime round five validates REVERSE order only',()=>{
 const f=fixture();phase3.start(f.room,'brain',f.now(),()=>0,'memory-lane');
 const m=f.room.board.minigame;m.round=4;m.memorySequence=[1,2];phase3.nextRound(f.room,f.now(),()=>3);
 assert.equal(m.round,5);assert.equal(m.display.reverse,true);
 m.secret.sequence=[1,2,3];m.phase='play';m.openAt=f.now();
 const id=f.room.players[0].id;
 phase3.submit(f.room,id,3,m.roundKey,f.now());assert.equal(m.progress[id],1);
 phase3.submit(f.room,id,2,m.roundKey,f.now());assert.equal(m.progress[id],2);
 phase3.submit(f.room,id,1,m.roundKey,f.now());assert.equal(m.roundAnswers[id].correct,true);
});

test('Every contestant has unique personality banter for both outcomes',()=>{
 const list=require('../public/shared/avatars.json');
 assert.equal(list.length,12);
 for(const a of list){assert(a.banter.win.length>8);assert(a.banter.lose.length>8);}
 assert.equal(new Set(list.map(a=>a.banter.win)).size,12);
});
