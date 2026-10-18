'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const phase4=require('../server/games/phase4');
const {GameRooms}=require('../server/rooms');
const data=name=>require('../data/'+name+'.json');
function fixture(game,n=4){
 let now=1000;const sequence=[];
 const rooms=new GameRooms({now:()=>now,randomInt:max=>(sequence.length?sequence.shift():0)%max});
 const {code}=rooms.create('tv');const sockets=[];
 for(let i=1;i<=n;i++){const sock='p'+i;sockets.push(sock);rooms.join({code,name:'Player '+i,avatarId:i,socketId:sock});rooms.setReady(code,sock,true);}
 rooms.startGame(code,'tv');const room=rooms.find(code);
 phase4.start(room,phase4.SPECS[game].category,now,rooms.randomInt,game);
 const m=()=>room.board.minigame;
 const advance=ms=>{now+=ms;rooms.sweep();};
 const tick=()=>rooms.sweep();
 const play=(i,value,key=m().roundKey)=>rooms.inputGame(code,sockets[i],value,key);
 const drawing=(i,points,key=m().roundKey)=>rooms.drawGame(code,sockets[i],points,key);
 const state=i=>rooms.state(code,false,i===null?null:room.players[i].id);
 const id=i=>room.players[i].id;
 const enter=()=>advance(5001);
 return {room,rooms,code,sockets,m,play,drawing,state,id,advance,enter,tick,push:(...a)=>sequence.push(...a)};
}
test('Phase 4 catalog has eight distinct named games in correct categories',()=>{
 assert.equal(phase4.CATALOG.length,8);assert.equal(new Set(phase4.CATALOG.map(x=>x.id)).size,8);
 for(const game of phase4.CATALOG){assert(['create','together'].includes(game.category));assert(game.rule.length>30);}
});
test('all six starter content collections have promised item counts and unique IDs',()=>{
 for(const [filename,count] of [['sketch-words',200],['noise-clues',80],['caption-scenes',30],['fib-facts',60],['mind-categories',60],['majority-questions',60]]){
  const a=data(filename);assert.equal(a.length,count,filename);assert.equal(new Set(a.map(i=>i.id)).size,count,filename);
 }
});
test('sketch: intro blocks inputs; artist sees word, saboteur hidden, public never sees secret',()=>{
 const f=fixture('sketch-sabotage',4),m=f.m(),word=m.secret.word,sab=m.secret.saboteur;
 assert.throws(()=>f.play(1,word),e=>e.code==='WAIT');
 const tv=f.rooms.state(f.code,true),guest=f.state(3);
 assert(!JSON.stringify(tv).includes(word));assert(!JSON.stringify(guest.board.minigame).includes('saboteurId'));
 assert.equal(f.state(0).board.minigame.private.word,word);
 assert.equal(f.state(1).board.minigame.private?.word,undefined);
 assert.equal(f.room.board.step,'minigame');assert(sab);
});
test('sketch: drawing accepts bounded points, hidden sabotager only three strokes, guess awards host and guesser',()=>{
 const f=fixture('sketch-sabotage',4);f.enter();const m=f.m(),sabIdx=f.room.players.findIndex(p=>p.id===m.secret.saboteur);
 assert.throws(()=>f.drawing(3===sabIdx?2:3,[[0,0],[50,50]],0),e=>e.code==='STALE');
 const host=0;f.drawing(host,[[0,0],[500,500]]);
 for(let i=0;i<3;i++)f.drawing(sabIdx,[[50,50],[100,100]]);
 assert.throws(()=>f.drawing(sabIdx,[[50,50],[100,100]]),e=>e.code==='LIMIT');
 const guesser=f.room.players.findIndex(p=>p.id!==m.host&&p.id!==m.secret.saboteur);
 assert(!JSON.stringify(f.state(guesser)).includes(m.secret.word));
 f.play(guesser,m.secret.word);assert.equal(f.room.board.step,'result');
 assert.equal(f.room.players[host].sparks,2);assert.equal(f.room.players[guesser].sparks,1);
});
test('sketch: if nobody guesses, saboteur earns exactly two Sparks',()=>{
 const f=fixture('sketch-sabotage',3);const sab=f.m().secret.saboteur;f.enter();f.advance(61000);
 assert.equal(f.room.board.step,'result');assert.equal(f.room.players.find(p=>p.id===sab).sparks,2);
});
test('noise: performer-only clue and flexible natural language guess',()=>{
 const f=fixture('noise-annoys',3),m=f.m();assert(!JSON.stringify(f.state(1)).includes(m.secret.answer));
 assert(f.state(0).board.minigame.private.clue);f.enter();
 assert.throws(()=>f.play(0,m.secret.answer),e=>e.code==='ROLE');
 const shortened=m.secret.answer.replace(/^(an?|the) /i,'').split(' ').slice(0,3).join(' ');
 f.play(1,shortened);assert.equal(f.room.board.step,'result');assert.equal(f.room.players[0].sparks,2);assert.equal(f.room.players[1].sparks,1);
});
test('caption: anonymous entry, no self-vote, ballots stay anonymous, winners scored',()=>{
 const f=fixture('caption-this',3);f.enter();
 f.play(0,'The Judge is stuck in the lift');f.play(1,'Pigeons wear business suits now');f.play(2,'I knew this would happen');
 assert.equal(f.m().phase,'vote');let i=f.m().optionOwners.findIndex(x=>x.owner===f.id(0));
 assert.throws(()=>f.play(0,i),e=>e.code==='INPUT');
 assert(!JSON.stringify(f.state(2)).includes('optionOwners'));
 const who=f.m().optionOwners.findIndex(x=>x.owner===f.id(1));
 f.play(0,who);f.play(2,who);f.play(1,f.m().optionOwners.findIndex(x=>x.owner===f.id(0)));
 assert.equal(f.room.board.step,'result');assert.equal(f.room.players[1].sparks,1);
});
test('fib: answer never leaks until reveal; unique fakes; points for voting truth and fooling others',()=>{
 const f=fixture('fib-factory',3),truth=f.m().secret.answer;f.enter();
 assert.equal(f.state(1).board.minigame.private?.answer,undefined);
 assert.equal(f.state(1).board.minigame.display.options,undefined);
 f.play(0,'Bananas');f.play(1,'Marshmallows');f.play(2,'Carrots');
 const m=f.m(),trueIndex=m.optionOwners.findIndex(x=>x.owner===null),hostFib=m.optionOwners.findIndex(x=>x.owner===f.id(0));
 assert(!JSON.stringify(f.state(1)).includes('optionOwners'));
 f.play(0,trueIndex);f.play(1,hostFib);f.play(2,trueIndex);
 assert.equal(f.room.board.step,'result');assert.equal(f.room.players[0].sparks,2);assert.equal(f.room.players[2].sparks,0);
});
test('Fib Factory does not reveal an accidentally correct fake through validation',()=>{
 const f=fixture('fib-factory',3),truth=f.m().secret.answer;f.enter();
 f.play(0,truth);assert.equal(f.m().answers[f.id(0)].guessedTruth,true);
 f.play(1,'Bananas');f.play(2,'Fish fingers');
 assert.equal(f.m().phase,'vote');assert(!f.m().optionOwners.some(o=>o.owner===f.id(0)));
 assert(!JSON.stringify(f.state(1)).includes('guessedTruth'));
});
test('mind meld: host chooses partner, no cross-phone word leakage, three tries and match',()=>{
 const f=fixture('mind-meld',4);f.enter();f.play(0,2);const m=f.m();assert.equal(m.partner,f.id(3));
 assert.throws(()=>f.play(1,'horse'),e=>e.code==='ROLE');
 f.play(0,'Castle');assert(!JSON.stringify(f.state(3)).includes('Castle'));f.play(3,'cat');
 assert.equal(f.m().phase,'reveal');f.advance(3100);assert.equal(f.m().round,2);
 f.play(0,'PEAR');f.play(3,'pear');assert.equal(f.room.board.step,'result');
 assert.equal(f.room.players[0].sparks,1);assert.equal(f.room.players[3].sparks,1);
});
test('majority rules: three secret vote rounds and tied-majority scoring',()=>{
 const f=fixture('majority-rules',4);f.enter();let first=f.m().roundKey;
 f.play(0,0);f.play(1,0);f.play(2,2);f.play(3,3);assert.equal(f.m().round,2);
 assert.throws(()=>f.play(0,0,first),e=>e.code==='STALE');
 for(let r=2;r<=3;r++){f.play(0,1);f.play(1,1);f.play(2,1);f.play(3,0);}
 assert.equal(f.room.board.step,'result');assert.equal(f.room.players[0].sparks,2);
 assert.equal(f.room.players[1].sparks,1);assert.equal(f.room.players[2].sparks,0);
});
test('relay: seat-order math, no other team answer leakage and winning team each +1',()=>{
 const f=fixture('relay-sums',4);f.enter();const m=f.m();
 const tasks=m.secret.tasks[0],first=tasks[0];
 assert.throws(()=>f.play(2,first.answer),e=>e.code==='TURN');
 for(const task of tasks){const i=f.room.players.findIndex(p=>p.id===task.id);assert.equal(f.state(i).board.minigame.private.prompt,task.prompt);f.play(i,task.answer);}
 assert.equal(f.room.board.step,'result');assert.equal(f.room.players[0].sparks,1);assert.equal(f.room.players[2].sparks,1);
 assert.equal(f.room.players[1].sparks,0);
});
test('bomb: clues split privately; wrong cut fails; correct cuts and code defuse the bomb',()=>{
 const fail=fixture('bomb-squad',4);fail.enter();const b=fail.m().secret;
 assert(!JSON.stringify(fail.rooms.state(fail.code,true)).includes(b.digits.join('')));
 const first=fail.m().display.wires.find(x=>x!==b.wires[0]);fail.play(0,first);
 assert.equal(fail.room.board.step,'result');
 const f=fixture('bomb-squad',4);f.enter();const s=f.m().secret;
 const clues=f.room.players.map((_,i)=>f.state(i).board.minigame.private.clues);
 assert.equal(clues.flat().length,4);
 for(const wire of s.wires)f.play(0,wire);
 assert.equal(f.m().display.keypadReady,true);
 f.play(0,s.digits.join(''));assert.equal(f.room.board.step,'result');
 assert.deepEqual(f.room.players.map(p=>p.sparks),[2,1,1,1]);
});
test('all eight games conclude via their deadlines without hanging, for two and eight players',()=>{
 for(const game of Object.keys(phase4.SPECS))for(const n of [2,8]){
  const f=fixture(game,n);f.enter();for(let i=0;i<6&&f.room.board.step==='minigame';i++)f.advance(120000);
  assert.equal(f.room.board.step,'result',`${game} ${n} players`);
 }
});
test('client-origin input cannot send stored correctness or bypass role, round key or pointer bounds',()=>{
 const f=fixture('sketch-sabotage',4);f.enter();const m=f.m();
 assert.throws(()=>f.drawing(0,[[1,-1],[2,2]]),e=>e.code==='INPUT');
 assert.throws(()=>f.play(0,m.secret.word),e=>e.code==='ROLE');
 assert.throws(()=>f.drawing(0,[[0,0],[1001,100]]),e=>e.code==='INPUT');
});
