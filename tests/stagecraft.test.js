'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {GameRooms}=require('../server/rooms');
const board=require('../server/board');
const phase3=require('../server/games/phase3');
function fixture(){
 let now=30000,queue=[];const rooms=new GameRooms({now:()=>now,randomInt:n=>queue.length?queue.shift()%n:0});
 const {code}=rooms.create('tv');for(let i=0;i<3;i++){rooms.join({code,name:'Contestant '+(i+1),avatarId:i+1,socketId:'p'+i});rooms.setReady(code,'p'+i,true);}
 rooms.setSettings(code,'tv',{rules:'showtime'});rooms.startGame(code,'tv');return {room:rooms.find(code),rooms,code,now:()=>now,advance:ms=>now+=ms,dice:(...d)=>queue.push(...d)};
}
test('Headline Bet is opt-in, requires a Spark and is announced to clients',()=>{
 const f=fixture();assert.equal(f.rooms.state(f.code).board.headline,false);
 assert.throws(()=>f.rooms.chooseGame(f.code,'p0',{action:'headline'}),e=>e.code==='SPARKS');
 f.room.players[0].sparks=3;f.rooms.chooseGame(f.code,'p0',{action:'headline'});
 assert.equal(f.rooms.state(f.code).board.headline,true);
 f.rooms.chooseGame(f.code,'p0',{action:'safe'});
 assert.equal(f.room.board.headline,false);
});
test('Headline win pays exactly two bonus Sparks and a winner earns a renewable Cue',()=>{
 const f=fixture();const p=f.room.players[0];p.sparks=3;p.cues=0;
 f.rooms.chooseGame(f.code,'p0',{action:'headline'});f.dice(0);f.rooms.rollGame(f.code,'p0');
 assert.equal(f.room.board.headlineEligible,true);assert.equal(f.room.board.step,'minigame');
 board.finishTurn(f.room,f.now(),'Round played',[p.id]);
 assert.equal(p.sparks,5);assert.equal(p.cues,1);assert.match(f.room.board.result.text,/HEADLINE HIT/);
 f.advance(3000);f.rooms.sweep();assert.equal(f.room.board.headline,false);
});
test('Headline loss loses at most one Spark; passive board spaces do not trigger bet',()=>{
 const f=fixture();const p=f.room.players[0];p.sparks=1;
 f.rooms.chooseGame(f.code,'p0',{action:'headline'});f.dice(0);f.rooms.rollGame(f.code,'p0');
 board.finishTurn(f.room,f.now(),'Nobody won',[]);assert.equal(p.sparks,0);assert.match(f.room.board.result.text,/HEADLINE FLOP/);
 const g=fixture();const x=g.room.players[0];x.sparks=3;
 g.rooms.chooseGame(g.code,'p0',{action:'headline'});g.dice(2);g.rooms.rollGame(g.code,'p0');
 assert.equal(g.room.board.step,'choose_target');assert.equal(g.room.board.headlineEligible,false);
 g.rooms.chooseGame(g.code,'p0',{targetId:g.room.players[1].id});
 assert.equal(x.sparks,3);
});
test('Director Cue replenishment is capped and works for non-host winners',()=>{
 const f=fixture(),[host,guest]=f.room.players;host.cues=2;guest.cues=1;
 board.finishTurn(f.room,f.now(),'Guest wins',[guest.id]);
 assert.equal(host.cues,2);assert.equal(guest.cues,2);
 assert.match(f.room.board.result.text,/Director Cue earned/);
});
test('Count Flash hides the requested type until after all three types are shown',()=>{
 const f=fixture();phase3.start(f.room,'speed',f.now(),()=>0,'count-flash');
 const m=f.room.board.minigame;
 assert.equal(m.display.targetIcon,null);assert.equal(m.privateTv.icons.length,3);
 assert.equal(m.privateTv.counts.reduce((a,b)=>a+b,0),36);
 assert(m.privateTv.counts.every(n=>n>=8&&n<=18));
 assert.equal(m.secret.count,m.privateTv.counts[m.privateTv.icons.indexOf(m.secret.targetIcon)]);
 const phone=phase3.publicState(f.room,false);
 assert.equal(phone.tvCue,undefined);assert.equal(phone.display.targetIcon,null);
 assert(!Object.hasOwn(phone,'secret'));
 assert.equal(phase3.publicState(f.room,true).tvCue.icons.length,3);
 phase3.tick(f.room,m.openAt,board.finishTurn,()=>0);
 assert.equal(m.phase,'play');assert.equal(m.display.targetIcon,m.secret.targetIcon);
 assert.match(m.question,/How many/);
});
test('Memory Lane round four validates REVERSE order only',()=>{
 const f=fixture();phase3.start(f.room,'brain',f.now(),()=>0,'memory-lane');
 const m=f.room.board.minigame;m.round=3;m.memorySequence=[1,2];phase3.nextRound(f.room,f.now(),()=>3);
 assert.equal(m.round,4);assert.equal(m.display.reverse,true);
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
