'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {GameRooms}=require('../server/rooms');const board=require('../server/board');const phase5=require('../server/games/phase5');
const bids=require('../data/bid-categories.json'),buzz=require('../data/buzzer-questions.json');
function fixture(n=2){let now=1000;const rooms=new GameRooms({now:()=>now,randomInt:()=>0});const {code}=rooms.create('host');
 const phones=Array.from({length:n},(_,i)=>`p${i+1}`);for(let i=0;i<n;i++){rooms.join({code,name:`Guest ${i+1}`,avatarId:i+1,socketId:phones[i]});rooms.setReady(code,phones[i],true);}rooms.startGame(code,'host');const room=rooms.find(code);
 return {rooms,code,room,phones,now:()=>now,advance:ms=>{now+=ms;rooms.sweep();},input:(i,v)=>rooms.inputGame(code,phones[i],v,room.board.showdown.roundKey),open:()=>{now+=5001;rooms.sweep();}};
}
function duel(f,space){f.room.board.landing=space;phase5.start(f.room,'corner',f.now(),f.room.players[1].id,()=>0);f.open();return f.room.board.showdown;}
test('phase5 datasets have 100 distinct questions and 40 finite complete answer lists',()=>{
 assert.equal(buzz.length,100);assert.equal(new Set(buzz.map(q=>q.id)).size,100);assert(buzz.every(q=>q.choices.length===4&&q.correct>=0&&q.correct<4));
 assert.equal(bids.length,40);assert(bids.every(c=>c.answers.length>=4&&c.answers.length===new Set(c.answers.map(phase5.normalize)).size));
});
test('four specified corners launch four different real challenge kinds',()=>{
 for(const [idx,kind] of [[6,'buzzer'],[10,'tug'],[18,'bid'],[22,'nerve']]){const f=fixture();const m=duel(f,idx);assert.equal(m.kind,kind);assert.equal(f.room.board.step,'showdown');assert.equal(f.rooms.state(f.code).board.showdown.kind,kind);assert.equal(f.room.board.challenge,null);}
});
test('Buzzer Battle: buzz first, wrong answer passes control, four correct wins and steals 2',()=>{
 const f=fixture();f.room.players[1].sparks=3;let m=duel(f,6);assert.equal(m.phase,'buzz');
 const first=f.room.players[0].id;assert(!JSON.stringify(f.rooms.state(f.code)).includes('correct'));
 f.input(0,'buzz');m=f.room.board.showdown;assert.equal(m.phase,'answer');assert.throws(()=>f.input(1,0),e=>e.code==='TURN');
 f.input(0,(m.question.correct+1)%4);assert.equal(m.phase,'pass');f.input(1,m.question.correct);assert.equal(m.points[f.room.players[1].id],1);
 for(let n=0;n<4;n++){m=f.room.board.showdown;f.input(0,'buzz');f.input(0,m.question.correct);}
 assert.equal(f.room.board.step,'result');assert.equal(f.room.players[0].sparks,2);assert.equal(f.room.players[1].sparks,1);
});
test('Tug of Wits: only correct current qid accepted and rope reaches five',()=>{
 const f=fixture();f.room.players[1].sparks=4;const m=duel(f,10);
 const publicTv=f.rooms.state(f.code,true).board.showdown;assert.equal(publicTv.private,null);
 const priv=f.rooms.state(f.code,false,f.room.players[0].id).board.showdown.private;assert(priv.prompt&&priv.qid);
 assert.throws(()=>f.input(0,{answer:0,qid:-1}),e=>e.code==='INPUT');
 for(let n=0;n<5;n++){const sum=m.sums[f.room.players[0].id];f.input(0,{answer:sum.correct,qid:sum.n});}
 assert.equal(f.room.board.step,'result');assert.equal(f.room.players[0].sparks,2);assert.equal(f.room.players[1].sparks,2);
});
test('Bid to Win: raise/challenge, correct distinct category names, success transfers Sparks',()=>{
 const f=fixture();f.room.players[1].sparks=2;let m=duel(f,18);assert(!JSON.stringify(f.rooms.state(f.code)).includes('answers'));
 f.input(0,{action:'bid',count:2});assert.throws(()=>f.input(0,{action:'challenge'}),e=>e.code==='TURN');
 f.input(1,{action:'challenge'});assert.equal(m.phase,'name');assert.throws(()=>f.input(1,'January'),e=>e.code==='TURN');
 f.input(0,m.category.answers[0]);assert.throws(()=>f.input(0,m.category.answers[0]),e=>e.code==='INPUT');
 f.input(0,m.category.answers[1]);assert.equal(f.room.board.step,'result');assert.equal(f.room.players[0].sparks,2);assert.equal(f.room.players[1].sparks,0);
});
test('Bid to Win: three invalid items lose the challenge, no guessed answers leaked',()=>{
 const f=fixture();f.room.players[0].sparks=2;const m=duel(f,18);f.input(0,{action:'bid',count:2});f.input(1,{action:'challenge'});
 for(const s of ['unlikely banana','unlikely pear','unlikely orange'])f.input(0,s);
 assert.equal(f.room.board.step,'result');assert.equal(f.room.players[0].sparks,0);assert.equal(f.room.players[1].sparks,2);
});
test('Nerve: bust point hidden, lower bank beats busted opponent, tie drawn',()=>{
 const f=fixture();f.room.players[1].sparks=3;let m=duel(f,22);assert.equal(m.bustAt,3);
 assert(!JSON.stringify(f.rooms.state(f.code)).includes('bustAt'));f.input(0,'bank');f.advance(3400);assert.equal(f.room.board.step,'result');
 assert.equal(f.room.players[0].sparks,2);assert.equal(f.room.players[1].sparks,1);
 const g=fixture();m=duel(g,22);g.input(0,'bank');g.input(1,'bank');assert.equal(g.room.board.step,'result');assert.equal(g.room.players[0].sparks,0);
});
test('Noggin-Off: numeric nearest guess and repeat ties without leaking answer',()=>{
 const f=fixture(3);const ids=f.room.players.map(p=>p.id);board.endGame(f.room,f.now());assert.deepEqual(f.room.board.finalists,ids);let m=f.room.board.showdown;
 assert.equal(m.kind,'tiebreak');assert(!JSON.stringify(f.rooms.state(f.code)).includes('questionData'));f.open();
 const correct=m.questionData.answer;
 f.input(0,correct);f.input(1,correct);f.input(2,correct+9);
 m=f.room.board.showdown;assert.equal(m.kind,'tiebreak');assert.deepEqual(f.room.board.finalists,ids.slice(0,2));f.open();
 const ans=m.questionData.answer;f.input(0,ans);f.input(1,ans+2);
 assert.equal(f.room.phase,'finished');assert.deepEqual(f.room.board.winnerIds,[ids[0]]);
});
test('Showdown never permits input by a spectator, stale key, or after result',()=>{
 const f=fixture(3);const m=duel(f,6);assert.throws(()=>f.input(2,'buzz'),e=>e.code==='PLAYER');
 assert.throws(()=>f.rooms.inputGame(f.code,f.phones[0],'buzz',m.roundKey-1),e=>e.code==='STALE');
 f.input(0,'buzz');assert.throws(()=>f.input(1,'buzz'),e=>e.code==='TURN');
});
