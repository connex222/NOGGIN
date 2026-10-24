'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {GameRooms}=require('../server/rooms');const games=require('../server/games/phase3');
const facts=require('../data/higher-lower.json'),close=require('../data/close-call.json'),words=require('../data/unscramble.json');
function fixture(gameId,players=3){
 let t=100_000;const rooms=new GameRooms({now:()=>t,randomInt:n=>0});const {code}=rooms.create('tv');
 const sock=[];for(let i=0;i<players;i++){sock.push('p'+i);rooms.join({code,name:'Player '+i,avatarId:i+1,socketId:sock[i]});rooms.setReady(code,sock[i],true);}
 rooms.startGame(code,'tv');const room=rooms.find(code);games.start(room,games.SPECS[gameId].category,t,()=>0,gameId);
 t+=5001;rooms.sweep();
 return {rooms,code,room,sock,time:()=>t,step:n=>{t+=n;rooms.sweep();},set:n=>{t=n},m:()=>room.board.minigame,input:(i,value)=>rooms.inputGame(code,sock[i],value,room.board.minigame.roundKey),state:()=>rooms.state(code)};
}
function finishRound(f){const d=f.m().deadline;f.set(d+1);f.rooms.sweep();}
test('Eight distinct playable Speed and Brain games with rules, category, and round count',()=>{
 assert.equal(games.CATALOG.length,8);assert.equal(games.CATALOG.filter(g=>g.category==='speed').length,4);assert.equal(games.CATALOG.filter(g=>g.category==='brain').length,4);
 for(const g of games.CATALOG){assert(g.rule.length>25);assert(g.rounds>=3);}
});
test('150 numerical facts, 60 numeric questions and 120 anagrams are in local JSON with unique IDs',()=>{
 assert.equal(facts.length,150);assert.equal(close.length,60);assert.equal(words.length,120);
 for(const xs of [facts,close,words])assert.equal(new Set(xs.map(x=>x.id)).size,xs.length);
 for(const f of facts)assert(Number.isFinite(f.value));for(const q of close)assert(Number.isInteger(q.answer));
 for(const q of words)assert(q.word.length>=6&&q.word.length<=8);
});
test('per-phone state does not expose mini-game answers, object counts, sequences or tokens',()=>{
 for(const id of Object.keys(games.SPECS)){
   const f=fixture(id);const m=f.m(),state=JSON.stringify(f.state());
   assert(!state.includes('"secret"'));assert(!state.includes('"tvCue"'));assert(!state.includes(f.room.players[0].token));
   assert.equal(f.state().board.minigame.id,id);
   if(id==='count-flash'||id==='memory-lane'){
     const tv=f.rooms.state(f.code,true).board.minigame;
     assert(tv.tvCue);
   }
 }
});
test('quick-draw premature tap is a misfire; earliest valid tap wins',()=>{
 const f=fixture('quick-draw');f.input(0,1);assert.equal(f.m().roundAnswers[f.room.players[0].id].correct,false);
 f.set(f.m().openAt+10);f.input(1,1);f.set(f.m().openAt+40);f.input(2,1);
 finishRound(f);assert.equal(f.m().scores[f.room.players[1].id],1);assert.equal(f.m().scores[f.room.players[0].id],0);
});
test('Count Flash hides count from phones, rejects early guess and rewards nearest/exact',()=>{
 const f=fixture('count-flash');assert.throws(()=>f.input(0,20),e=>e.code==='WAIT');
 const correct=f.m().secret.count;f.set(f.m().openAt+1);
 f.input(0,correct+1);f.input(1,correct);f.input(2,correct+5);finishRound(f);
 assert.equal(f.m().scores[f.room.players[1].id],4);
});
test('Odd Spot prevents false taps with a three-second penalty and accepts correct cell',()=>{
 const f=fixture('odd-spot');const idx=f.m().secret.index;
 f.input(0,(idx+1)%36);assert.throws(()=>f.input(0,idx),e=>e.code==='WAIT');
 f.set(f.time()+3001);f.input(0,idx);assert.equal(f.m().roundAnswers[f.room.players[0].id].correct,true);
});
test('Colour Clash judges ink rather than word and subtracts for wrong answers',()=>{
 const f=fixture('colour-clash');const correct=['RED','BLUE','GREEN','YELLOW'].indexOf(f.m().display.ink);
 f.input(0,correct);f.input(1,(correct+1)%4);finishRound(f);
 assert.equal(f.m().scores[f.room.players[0].id],1);assert.equal(f.m().scores[f.room.players[1].id],-1);
});
test('Higher or Lower gives one second chance, then eliminates on two strikes',()=>{
 const f=fixture('higher-lower');const id=f.room.players[1].id;let correct=f.m().secret.answer;
 f.input(0,correct);f.input(1,1-correct);f.input(2,correct);finishRound(f);
 assert(!f.m().eliminated.includes(id));assert.equal(f.m().strikes[id],1);
 assert.throws(()=>f.input(1,0),e=>e.code==='WAIT');
 finishRound(f);correct=f.m().secret.answer;f.input(1,1-correct);finishRound(f);
 assert(f.m().eliminated.includes(id));assert.equal(f.m().strikes[id],2);
 finishRound(f);if(f.room.board.step==='minigame')assert.throws(()=>f.input(1,0),e=>e.code==='PLAYER');
});
test('Memory Lane requires the sequence, tracks progress, and scores completed pattern',()=>{
 const f=fixture('memory-lane');const seq=f.m().secret.sequence;
 assert.throws(()=>f.input(0,seq[0]),e=>e.code==='WAIT');f.set(f.m().openAt+1);
 seq.forEach(x=>f.input(0,x));assert.equal(f.m().roundAnswers[f.room.players[0].id].correct,true);
 f.input(1,(seq[0]+1)%6);finishRound(f);
 assert.equal(f.m().scores[f.room.players[0].id],seq.length);
});
test('Close Call ranks guesses by distance instead of mixing unit scales',()=>{
 const f=fixture('close-call');const answer=f.m().secret.answer;
 f.input(0,answer);f.input(1,answer+20);f.input(2,answer+200);finishRound(f);
 const scores=f.m().scores,ps=f.room.players;assert(scores[ps[0].id]>scores[ps[1].id]);assert(scores[ps[1].id]>scores[ps[2].id]);
});
test('Unscramble rejects wrong words then awards a point to earliest correct answer',()=>{
 const f=fixture('unscramble');f.input(0,'WRONG');assert(!f.m().roundAnswers[f.room.players[0].id]);
 const correct=f.m().secret.answer;f.input(1,correct);f.set(f.time()+810);f.input(0,correct);finishRound(f);
 assert.equal(f.m().scores[f.room.players[1].id],1);
});
test('stale round keys and invalid inputs fail server-side',()=>{
 const f=fixture('colour-clash');const key=f.m().roundKey;
 assert.throws(()=>f.rooms.inputGame(f.code,f.sock[0],999,key),e=>e.code==='INPUT');
 finishRound(f);assert.throws(()=>f.rooms.inputGame(f.code,f.sock[0],0,key),e=>e.code==='WAIT');
 finishRound(f);assert.throws(()=>f.rooms.inputGame(f.code,f.sock[0],0,key),e=>e.code==='STALE');
});
test('all eight games reach results, award scores and clear mini-game state without client scoring',()=>{
 for(const id of Object.keys(games.SPECS)){
  const f=fixture(id,2);for(let i=0;i<26&&f.room.board.step==='minigame';i++)finishRound(f);
  assert.equal(f.room.board.step,'result',id);assert.equal(f.room.board.minigame,null,id);
  assert(f.room.board.result?.text.includes(games.SPECS[id].name),id);
 }
});
test('a speed space calls a Speed round game instead of starting a mini-game mid-turn',()=>{
 const f=fixture('colour-clash');const b=f.room.board;
 b.step='await_roll';b.stage='board';b.minigame=null;f.room.players[0].position=1;b.activeId=f.room.players[0].id;
 f.rooms.rollGame(f.code,f.sock[0]);assert.equal(b.step,'result');assert.equal(b.roundCategory,'speed');assert.equal(b.minigame,null);
});

test('round reveal hides answers until conclusion, then publishes answer, winners, and prevents late inputs',()=>{
 const f=fixture('close-call');const correct=f.m().secret.answer;
 assert.equal(f.state().board.minigame.lastRoundResult,undefined);
 f.input(0,correct);finishRound(f);
 const exposed=f.state().board.minigame;
 assert.equal(exposed.phase,'reveal');assert.equal(exposed.lastRoundResult.answer,correct);
 assert(exposed.lastRoundResult.winners.includes(f.room.players[0].id));
 assert.throws(()=>f.input(1,correct),e=>e.code==='WAIT');
 const oldKey=exposed.roundKey;finishRound(f);
 assert.equal(f.m().roundKey,oldKey+1);
 assert.equal(f.state().board.minigame.lastRoundResult,undefined);
});
