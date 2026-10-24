'use strict';
// NOGGIN v3 round loop: 28-space trapezium, called round games, Last Orders.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {GameRooms}=require('../server/rooms');
const board=require('../server/board');
const layout=require('../server/layout');
const phase4=require('../server/games/phase4');
function fixture(n=3,settings={}) {
 let now=1000;const sequence=[];const rooms=new GameRooms({now:()=>now,randomInt:max=>(sequence.length?sequence.shift():0)%max});
 const {code}=rooms.create('tv');const people=[];
 for(let i=1;i<=n;i++){const sock='phone'+i;rooms.join({code,name:'Player '+i,avatarId:i,socketId:sock});rooms.setReady(code,sock,true);people.push(sock);}
 if(Object.keys(settings).length)rooms.setSettings(code,'tv',settings);
 rooms.startGame(code,'tv');
 return {rooms,code,people,room:rooms.find(code),now:()=>now,advance:ms=>{now+=ms},dice:d=>sequence.push(...d),
  phoneOf(id){return people[this.room.players.findIndex(p=>p.id===id)];}};
}
// Put the active player `die` spaces before `space` and roll that number.
function landOn(f,space,die=1){const p=f.room.players.find(x=>x.id===f.room.board.activeId);p.position=(space-die+28)%28;f.dice([die-1]);f.rooms.rollGame(f.code,f.phoneOf(p.id));return p;}
function nextResult(f){f.advance(4501);f.rooms.sweep();}

test('28-space trapezium: a Showdown on all four corners, paired lifts and no doubled-up colours',()=>{
 assert.equal(board.SPACES.length,28);
 const counts={};for(const s of board.SPACES)counts[s]=(counts[s]||0)+1;
 assert.deepEqual(counts,{start:1,brain:4,speed:3,create:3,together:3,showdown:4,lift:2,drain:2,applause:2,swap:1,wildcard:2,pickpocket:1});
 assert.deepEqual(layout.CORNERS,[6,10,18,22]);
 for(const i of layout.CORNERS)assert.equal(board.SPACES[i],'showdown');
 assert.deepEqual(Object.keys(layout.SHOWDOWN_KINDS).map(Number),layout.CORNERS);
 for(const [from,to] of Object.entries(board.LIFTS)){assert.equal(board.SPACES[from],'lift');assert.equal(board.LIFTS[to],Number(from));}
 for(let i=0;i<28;i++)assert.notEqual(board.SPACES[i],board.SPACES[(i+1)%28],`spaces ${i} and ${i+1} repeat`);
 const shipped=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/shared/board-data.json'),'utf8'));
 assert.deepEqual(shipped,layout.boardData(),'run node tools/make-board-data.js');
});

test('show length: Auto sizes rounds to the panel; host may pick a fixed length',()=>{
 assert.equal(fixture(2).room.board.totalRounds,12);
 assert.equal(fixture(4).room.board.totalRounds,10);
 assert.equal(fixture(6).room.board.totalRounds,8);
 assert.equal(fixture(3,{rounds:6}).room.board.totalRounds,6);
 const f=fixture(2);assert.equal(f.room.board.round,1);assert.equal(f.room.board.stage,'board');
});

test('a category space CALLS the round game and makes the caller its host; a later colour steals the call',()=>{
 const f=fixture(3);const [a,b]=f.room.players;
 landOn(f,1);assert.equal(f.room.board.step,'result');assert.equal(f.room.board.minigame,null);
 assert.equal(f.room.board.roundCategory,'brain');assert.equal(f.room.board.roundCaller,a.id);
 const state=f.rooms.state(f.code);assert.deepEqual(state.board.roundGame,{category:'brain',callerId:a.id,locked:false});
 nextResult(f);assert.equal(f.room.board.activeId,b.id);
 landOn(f,2);assert.equal(f.room.board.roundCategory,'speed');assert.equal(f.room.board.roundCaller,b.id);
 assert.match(f.room.board.result.text,/taking the spotlight from Player 1/);
});

test('a Wildcard picks, locks and hosts the round game; later colours cannot override it',()=>{
 const f=fixture(3);const [a]=f.room.players;
 landOn(f,14);assert.equal(f.room.board.step,'choose_category');
 assert.throws(()=>f.rooms.chooseGame(f.code,f.people[0],{category:'unapproved'}),e=>e.code==='CATEGORY');
 f.rooms.chooseGame(f.code,f.people[0],{category:'together'});
 assert.equal(f.room.board.roundLocked,true);assert.equal(f.room.board.roundCaller,a.id);assert.equal(f.room.board.step,'result');
 nextResult(f);landOn(f,1);
 assert.equal(f.room.board.roundCategory,'together');assert.equal(f.room.board.roundCaller,a.id);assert.match(f.room.board.result.text,/locked/);
});

test('after everyone rolls, the called round game starts with the caller as host; next round rotates the first roller',()=>{
 const f=fixture(3);const [a,b,c]=f.room.players;
 landOn(f,2);nextResult(f);         // A calls Speed
 landOn(f,5);nextResult(f);         // B: Applause
 landOn(f,13);                      // C: Swap
 f.rooms.chooseGame(f.code,f.people[2],{targetId:a.id});nextResult(f);
 assert.equal(f.room.board.stage,'round-game');assert.equal(f.room.board.step,'minigame');
 assert.equal(f.room.board.minigame.category,'speed');assert.equal(f.room.board.activeId,a.id);
 assert.match(f.room.board.event.text,/ROUND 1 GAME/);
 assert.throws(()=>f.rooms.rollGame(f.code,f.people[0]),e=>e.code==='STEP');
 board.finishTurn(f.room,f.now(),'Round game over.',[]);nextResult(f);
 assert.equal(f.room.board.round,2);assert.equal(f.room.board.stage,'board');assert.equal(f.room.board.activeId,b.id);
 assert.equal(f.room.board.roundCategory,null);assert.equal(f.room.board.showdownPlayed,false);
 void c;
});

test('if nobody calls a game the studio picks a category and the host rotates by round',()=>{
 const f=fixture(2);
 landOn(f,5);nextResult(f);landOn(f,25);f.dice([1]);nextResult(f);
 assert.equal(f.room.board.stage,'round-game');assert.equal(f.room.board.minigame.category,'brain');
 assert.equal(f.room.board.activeId,f.room.players[0].id);assert.match(f.room.board.event.text,/studio picked BRAIN/);
});

test('round-game winners earn a bonus Spark on top of the mini-game award (host +3, guesser +2)',()=>{
 const f=fixture(3);const b=f.room.board;
 b.stage='round-game';b.activeId=f.room.players[0].id;
 phase4.start(f.room,'create',f.now(),()=>0,'sketch-sabotage');
 const m=b.minigame;f.advance(5001);f.rooms.sweep();
 const guesser=f.room.players.find(p=>p.id!==m.host&&p.id!==m.secret.saboteur);
 f.rooms.inputGame(f.code,f.phoneOf(guesser.id),m.secret.word,m.roundKey);
 assert.equal(b.step,'result');assert.equal(f.room.players[0].sparks,3);assert.equal(guesser.sparks,2);
 assert.match(b.result.text,/Round-game bonus/);
});

test('START pays +1 for passing and +2 for landing; Applause pays +2',()=>{
 const f=fixture(2);const p=landOn(f,2,4);assert.equal(p.position,2);assert.equal(p.sparks,1);
 const g=fixture(2);const q=landOn(g,0,3);assert.equal(q.sparks,2);
 const h=fixture(2);const r=landOn(h,5);assert.equal(r.sparks,2);assert.match(h.room.board.result.text,/APPLAUSE/);
});

test('Stage Lifts jump across the stage without triggering the destination',()=>{
 const f=fixture(2);const p=landOn(f,8);assert.equal(p.position,20);assert.equal(f.room.board.step,'result');
 nextResult(f);const q=landOn(f,20);assert.equal(q.position,8);
});

test('Swap exchanges tokens; Pickpocket robs the leader and never goes below zero',()=>{
 const f=fixture(3);f.room.players[1].position=20;landOn(f,13);
 assert.equal(f.room.board.step,'choose_target');
 assert.throws(()=>f.rooms.chooseGame(f.code,f.people[0],{targetId:f.room.players[0].id}),e=>e.code==='TARGET');
 f.rooms.chooseGame(f.code,f.people[0],{targetId:f.room.players[1].id});
 assert.equal(f.room.players[0].position,20);assert.equal(f.room.players[1].position,13);
 const g=fixture(3);g.room.players[1].sparks=4;g.room.players[2].sparks=5;landOn(g,16);
 assert.equal(g.room.players[0].sparks,1);assert.equal(g.room.players[2].sparks,4);
 const h=fixture(2);landOn(h,16);assert.equal(h.room.players[0].sparks,0);assert.match(h.room.board.result.text,/nobody has a Spark/);
});

test('Brain Drain: wrong answer costs one Spark; correct answer survives',()=>{
 const f=fixture(2);f.room.players[0].sparks=3;landOn(f,3);assert.equal(f.room.board.challenge.kind,'drain');
 f.rooms.answerGame(f.code,f.people[0],(f.room.board.challenge.correct+1)%3);assert.equal(f.room.players[0].sparks,2);
 const g=fixture(2);g.room.players[0].sparks=2;landOn(g,24);g.rooms.answerGame(g.code,g.people[0],g.room.board.challenge.correct);assert.equal(g.room.players[0].sparks,2);
 assert.match(g.room.board.result.text,/survived/);
});

test('corner Showdown steals up to 2 Sparks; only one Showdown per round, later corners pay a Corner Bonus',()=>{
 const f=fixture(3);f.room.players[1].sparks=1;landOn(f,6);
 assert.equal(f.room.board.step,'choose_opponent');f.rooms.chooseGame(f.code,f.people[0],{targetId:f.room.players[1].id});
 assert.equal(f.room.board.showdown.kind,'buzzer');assert.equal(f.room.board.showdown.title,'Buzzer Battle');
 f.advance(5001);f.rooms.sweep();
 for(let i=0;i<4;i++){let m=f.room.board.showdown;f.rooms.inputGame(f.code,f.people[0],'buzz',m.roundKey);m=f.room.board.showdown;f.rooms.inputGame(f.code,f.people[0],m.question.correct,m.roundKey);}
 assert.equal(f.room.players[0].sparks,1);assert.equal(f.room.players[1].sparks,0);
 nextResult(f);landOn(f,22);
 assert.equal(f.room.board.step,'result');assert.equal(f.room.players[1].sparks,1);assert.match(f.room.board.result.text,/Corner Bonus/);
});

test('every corner launches its own Showdown kind',()=>{
 for(const [space,kind] of Object.entries(layout.SHOWDOWN_KINDS)){
  const f=fixture(2);landOn(f,Number(space));f.rooms.chooseGame(f.code,f.people[0],{targetId:f.room.players[1].id});
  assert.equal(f.room.board.showdown.kind,kind);assert.equal(f.room.board.showdown.title,layout.SHOWDOWNS[space]);
 }
});

test('LAST ORDERS doubles Spark gains in the final round but never doubles losses',()=>{
 const f=fixture(2,{rounds:6});f.room.board.round=6;
 assert.equal(f.rooms.state(f.code).board.lastOrders,true);
 const p=landOn(f,5);assert.equal(p.sparks,4);assert.match(f.room.board.result.text,/LAST ORDERS DOUBLES IT/);
 nextResult(f);const q=f.room.players.find(x=>x.id===f.room.board.activeId);q.sparks=3;f.room.board.turnStartSparks[q.id]=3;landOn(f,3);
 f.rooms.answerGame(f.code,f.phoneOf(q.id),(f.room.board.challenge.correct+1)%3);assert.equal(q.sparks,2);
});

test('after the final round game the most Sparks wins; a tie for first goes to the Noggin-Off',()=>{
 const f=fixture(2,{rounds:6});const b=f.room.board;b.round=6;b.stage='round-game';b.activeId=f.room.players[0].id;
 f.room.players[0].sparks=9;f.room.players[1].sparks=7;b.turnStartSparks={[f.room.players[0].id]:9,[f.room.players[1].id]:7};
 board.finishTurn(f.room,f.now(),'Final game.',[]);nextResult(f);
 assert.equal(f.room.phase,'finished');assert.deepEqual(b.winnerIds,[f.room.players[0].id]);assert.match(b.event.text,/wins NOGGIN with 9 Sparks/);
 const g=fixture(2,{rounds:6});const gb=g.room.board;gb.round=6;gb.stage='round-game';
 g.room.players.forEach(p=>{p.sparks=7;gb.turnStartSparks[p.id]=7;});board.finishTurn(g.room,g.now(),'Final game.',[]);nextResult(g);
 assert.equal(gb.stage,'noggin-off');assert.equal(gb.showdown.kind,'tiebreak');
 g.advance(5001);g.rooms.sweep();const c=gb.showdown;
 g.rooms.inputGame(g.code,g.people[0],c.questionData.answer,c.roundKey);g.rooms.inputGame(g.code,g.people[1],c.questionData.answer+20,c.roundKey);
 assert.equal(g.room.phase,'finished');assert.deepEqual(gb.winnerIds,[g.room.players[0].id]);
});

test('only the host can start; game state hides tokens and secrets',()=>{
 const f=fixture(3);assert.equal(f.room.phase,'board');assert.equal(f.room.board.activeId,f.room.players[0].id);
 assert.throws(()=>f.rooms.startGame(f.code,'tv'),e=>e.code==='PHASE');
 assert.throws(()=>f.rooms.rollGame(f.code,f.people[1]),e=>e.code==='TURN');
 landOn(f,1);const state=f.rooms.state(f.code);
 assert(!JSON.stringify(state).includes(f.room.players[0].token));assert.equal(state.board.step,'result');
 assert.throws(()=>f.rooms.rollGame(f.code,f.people[1]),e=>e.code==='STEP');
});

test('gameplay reconnect keeps seat, pauses active turn, then skips after 30 seconds',()=>{
 const f=fixture(2);const p=f.room.players[0];f.rooms.disconnect(f.code,f.people[0]);f.rooms.sweep();assert.equal(f.room.board.pausedAt,f.now());
 f.advance(30_001);f.rooms.sweep();assert.equal(f.room.board.step,'result');assert.match(f.room.board.result.text,/skipped/);
 assert.equal(f.room.players.length,2);f.advance(4501);f.rooms.sweep();assert.equal(f.room.board.activeId,f.room.players[1].id);
 f.rooms.resume({code:f.code,role:'player',token:p.token,socketId:'back'});assert.equal(f.room.players[0].socketId,'back');
});
