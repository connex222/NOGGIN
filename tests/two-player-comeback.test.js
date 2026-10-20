'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const board=require('../server/board');
function room(n,style='sequential'){
 const players=Array.from({length:n},(_,i)=>({id:String(i),name:`Guest ${i+1}`,seat:i+1,ready:true,socketId:`phone${i}`,sparks:0,position:0}));
 const r={phase:'lobby',hostSocketId:'tv',settings:{target:12,roundStyle:style,timerSpeed:'normal',rules:'classic'},players};
 board.start(r,1000);return r;
}
test('two-player comeback rewards a contest win when trailing at the mode-specific threshold at turn start',()=>{
 const r=room(2),[a,b]=r.players;
 r.board.turnStartSparks={[a.id]:2,[b.id]:6};a.sparks=4;b.sparks=6;
 board.finishTurn(r,2000,'Contest decided',[a.id]);
 assert.equal(a.sparks,6);assert.match(r.board.result.text,/Comeback bonus/);
});
test('two-player comeback does not pay for a loss or small gap',()=>{
 const r=room(2),[a,b]=r.players;
 r.board.turnStartSparks={[a.id]:5,[b.id]:6};
 board.finishTurn(r,2000,'Contest decided',[a.id]);assert.equal(a.sparks,0);
 const t=room(2),[c,d]=t.players;t.board.turnStartSparks={[c.id]:2,[d.id]:6};
 board.finishTurn(t,2000,'Contest decided',[d.id]);assert.equal(c.sparks,0);
});
test('comeback is entirely disabled for three or more players',()=>{
 for(const n of [3,4,6,8]){
  const r=room(n),a=r.players[0];r.board.turnStartSparks=Object.fromEntries(r.players.map((p,i)=>[p.id,i?8:0]));
  board.finishTurn(r,2000,'Contest decided',[a.id]);assert.equal(a.sparks,n>=8?2:n>=4?1:0);assert.doesNotMatch(r.board.result.text,/Comeback bonus/);
 }
});
test('comeback also applies only to two-player shared rounds',()=>{
 const r=room(2,'everyone'),[a,b]=r.players;r.board.turnStartSparks={[a.id]:1,[b.id]:5};
 board.finishTurn(r,2000,'Contest decided',[a.id]);assert.equal(a.sparks,2);
});
