'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const game=require('../server/games/phase3');
function room(){return {players:[{id:'one'},{id:'two'}],settings:{rules:'classic',timerSpeed:'normal'},board:{}};}
for(let level=1;level<=5;level++)test(`Odd Spot level ${level} has matching public puzzle without leaking answer index`,()=>{
 const r=room();game.start(r,'speed',1000,()=>0,'odd-spot');
 for(let i=1;i<level;i++)game.nextRound(r,1000+i*20000,()=>0);
 const m=r.board.minigame,phone=game.publicState(r,false),tv=game.publicState(r,true);
 assert.equal(phone.round,level);
 assert.deepEqual(phone.display,tv.display);
 assert.equal(phone.display.grid.length,36);
 assert.equal(phone.display.styles.length,36);
 assert.equal(JSON.stringify(phone).includes('"index"'),false);
 assert.equal(phone.display.grid.length,36);
 if(level===3||level===4)assert.equal(phone.display.styles.filter(x=>x.rotation!==0).length,1);
 if(level===5)assert.equal(new Set(phone.display.styles.map(x=>x.tone)).size,2);
});
