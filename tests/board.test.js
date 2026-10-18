'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {GameRooms}=require('../server/rooms');
const board=require('../server/board');
function fixture(n=3) {
 let now=1000;const sequence=[];const rooms=new GameRooms({now:()=>now,randomInt:max=>(sequence.length?sequence.shift():0)%max});
 const {code}=rooms.create('tv');let people=[];
 for(let i=1;i<=n;i++) {const sock='phone'+i;rooms.join({code,name:'Player '+i,avatarId:i,socketId:sock});rooms.setReady(code,sock,true);people.push(sock);}
 rooms.setSettings(code,'tv',{rules:'showtime'});rooms.startGame(code,'tv');return {rooms,code,people,room:rooms.find(code),now:()=>now,advance:n=>{now+=n},dice:d=>sequence.push(...d)};
}
function challengeAnswer(f,correctPlayer=0){const c=f.room.board.challenge;if(!c)return;const participants=c.participants.slice();participants.forEach((id,index)=>{
 const player=f.room.players.find(p=>p.id===id);const ans=player===f.room.players[correctPlayer]?c.correct:(c.correct+1)%3;
 f.rooms.answerGame(f.code,f.people[player.seat-1],ans);
 });}
test('36 spaces have exact distribution, 4 corner showdowns, colours on each edge and no duplicate adjacent category',()=>{
 const counts={};for(const s of board.SPACES)counts[s]=(counts[s]||0)+1;
 assert.deepEqual(counts,{start:1,create:6,brain:6,swap:2,together:6,speed:6,showdown:4,lift:2,wildcard:1,drain:1,pickpocket:1});
 for(const i of [7,15,22,30])assert.equal(board.SPACES[i],'showdown');
 for(const ids of [[0,1,2,3,4,5,6,31,32,33,34,35],[8,9,10,11,12,13,14],[16,17,18,19,20,21],[23,24,25,26,27,28,29]])for(const c of ['speed','brain','create','together'])assert(ids.some(i=>board.SPACES[i]===c));
 for(let i=0;i<36;i++)assert(!(board.SPACES[i]===board.SPACES[(i+1)%36]&&['speed','brain','create','together'].includes(board.SPACES[i])));
});
test('only the host can start; game state hides secret tokens and correct answers',()=>{
 const f=fixture();assert.equal(f.room.phase,'board');assert.equal(f.room.board.activeId,f.room.players[0].id);
 assert.throws(()=>f.rooms.startGame(f.code,'tv'),e=>e.code==='PHASE');
 f.dice([0]);f.rooms.rollGame(f.code,f.people[0]);
 assert.equal(f.room.players[0].position,1);
 const state=f.rooms.state(f.code);assert.equal(state.board.step,'minigame');assert.equal(state.board.minigame.category,'create');assert.equal(state.board.minigame.private,undefined);assert(!JSON.stringify(state).includes(f.room.players[0].token));
 assert.throws(()=>f.rooms.rollGame(f.code,f.people[1]),e=>e.code==='STEP');
});
test('Create landing initiates a real game; host and guest win awards are server-owned',()=>{
 const f=fixture(3);f.dice([0]);f.rooms.rollGame(f.code,f.people[0]);
 assert.deepEqual(f.room.board.lastMove.path,[1]);
 require('../server/games/phase4').start(f.room,'create',f.now(),()=>0,'sketch-sabotage');
 const m=f.room.board.minigame;assert.equal(m.id,'sketch-sabotage');
 assert.throws(()=>f.rooms.inputGame(f.code,f.people[1],m.secret.word,m.roundKey),e=>e.code==='WAIT');
 f.advance(5001);f.rooms.sweep();
 const guesses=f.room.players.filter(p=>p.id!==m.host&&p.id!==m.secret.saboteur);
 assert.equal(guesses.length,1);
 f.rooms.inputGame(f.code,f.people[guesses[0].seat-1],m.secret.word,m.roundKey);
 assert.equal(f.room.board.step,'result');assert.equal(f.room.players[0].sparks,2);
 assert.equal(guesses[0].sparks,1);assert.equal(f.room.board.minigame,null);
 f.advance(4501);f.rooms.sweep();assert.equal(f.room.board.turn,2);
});
test('catch-up player gets two server rolled dice, selects one, rejects other player',()=>{
 const f=fixture(3);f.room.players[1].sparks=3;f.dice([1,4]);f.rooms.rollGame(f.code,f.people[0]);
 assert.equal(f.room.board.step,'choose_die');assert.deepEqual(f.room.board.rolls,[2,5]);
 assert.throws(()=>f.rooms.pickGameDie(f.code,f.people[1],0),e=>e.code==='TURN');
 f.rooms.pickGameDie(f.code,f.people[0],1);assert.equal(f.room.players[0].position,5);
});
test('passing START gives +1 but landing on it gives +2 only',()=>{
 const f=fixture(2);f.room.players[0].position=33;f.dice([4]);f.rooms.rollGame(f.code,f.people[0]);assert.equal(f.room.players[0].position,2);assert.equal(f.room.players[0].sparks,1);
 const g=fixture(2);g.room.players[0].position=35;g.dice([0]);g.rooms.rollGame(g.code,g.people[0]);assert.equal(g.room.players[0].position,0);assert.equal(g.room.players[0].sparks,2);
});
test('two stage lift spaces teleport without triggering the destination event',()=>{
 const f=fixture(2);f.room.players[0].position=10;f.dice([0]);f.rooms.rollGame(f.code,f.people[0]);assert.equal(f.room.players[0].position,26);assert.equal(f.room.board.step,'result');
});
test('swap target selection exchanges tokens and pickpocket cannot steal below zero',()=>{
 const f=fixture(3);f.room.players[0].position=2;f.room.players[1].position=20;f.dice([0]);f.rooms.rollGame(f.code,f.people[0]);
 assert.equal(f.room.board.step,'choose_target');assert.throws(()=>f.rooms.chooseGame(f.code,f.people[0],{targetId:f.room.players[0].id}),e=>e.code==='TARGET');
 f.rooms.chooseGame(f.code,f.people[0],{targetId:f.room.players[1].id});assert.equal(f.room.players[0].position,20);assert.equal(f.room.players[1].position,3);
 const g=fixture(3);g.room.players[0].position=34;g.room.players[1].sparks=4;g.room.players[2].sparks=5;g.dice([0,0]);g.rooms.rollGame(g.code,g.people[0]);if(g.room.board.step==='choose_die')g.rooms.pickGameDie(g.code,g.people[0],0);
 assert.equal(g.room.players[0].sparks,1);assert.equal(g.room.players[2].sparks,4);
});
test('brain drain wrong or late answer costs one Spark; correct answer survives',()=>{
 const f=fixture(2);f.room.players[0].position=28;f.room.players[0].sparks=3;f.dice([0]);f.rooms.rollGame(f.code,f.people[0]);assert.equal(f.room.board.challenge.kind,'drain');
 f.rooms.answerGame(f.code,f.people[0],(f.room.board.challenge.correct+1)%3);assert.equal(f.room.players[0].sparks,2);
 const g=fixture(2);g.room.players[0].position=28;g.room.players[0].sparks=2;g.dice([0]);g.rooms.rollGame(g.code,g.people[0]);g.rooms.answerGame(g.code,g.people[0],g.room.board.challenge.correct);assert.equal(g.room.players[0].sparks,2);
});
test('Showdown chooses a rival and transfers up to 2 Sparks from loser',()=>{
 const f=fixture(2);f.room.players[0].position=6;f.room.players[1].sparks=1;f.dice([0,0]);f.rooms.rollGame(f.code,f.people[0]);if(f.room.board.step==='choose_die')f.rooms.pickGameDie(f.code,f.people[0],0);
 assert.equal(f.room.board.step,'choose_opponent');f.rooms.chooseGame(f.code,f.people[0],{targetId:f.room.players[1].id});
 assert.equal(f.room.board.showdown.kind,'buzzer');f.advance(5001);f.rooms.sweep();for(let i=0;i<4;i++){let m=f.room.board.showdown;f.rooms.inputGame(f.code,f.people[0],'buzz',m.roundKey);m=f.room.board.showdown;f.rooms.inputGame(f.code,f.people[0],m.question.correct,m.roundKey);}assert.equal(f.room.players[0].sparks,1);assert.equal(f.room.players[1].sparks,0);
});
test('wildcard category chosen on phone starts Speed mini-game for everyone',()=>{
 const f=fixture(2);f.room.players[0].position=18;f.dice([0]);f.rooms.rollGame(f.code,f.people[0]);
 assert.equal(f.room.board.step,'choose_category');assert.throws(()=>f.rooms.chooseGame(f.code,f.people[0],{category:'unapproved'}),e=>e.code==='CATEGORY');
 f.rooms.chooseGame(f.code,f.people[0],{category:'speed'});assert.equal(f.room.board.step,'minigame');assert.equal(f.room.board.minigame.category,'speed');
});
test('automatic next turn and target finish, sudden-death closest-answer tie',()=>{
 const f=fixture(2);f.room.players[0].sparks=7;f.room.players[1].sparks=7;f.room.settings.target=8;
 f.room.players[0].position=35;f.dice([0]);f.rooms.rollGame(f.code,f.people[0]);assert.deepEqual(f.room.board.finalists,[f.room.players[0].id]);
 f.advance(4501);f.rooms.sweep();assert.equal(f.room.phase,'finished');assert.deepEqual(f.room.board.winnerIds,[f.room.players[0].id]);
 const g=fixture(2);g.room.board.finalists=g.room.players.map(p=>p.id);board.nextTurn(g.room,g.now());assert.equal(g.room.board.showdown.kind,'tiebreak');
 g.advance(5001);g.rooms.sweep();const c=g.room.board.showdown;g.rooms.inputGame(g.code,g.people[0],c.questionData.answer,c.roundKey);g.rooms.inputGame(g.code,g.people[1],c.questionData.answer+20,c.roundKey);
 assert.equal(g.room.phase,'finished');assert.deepEqual(g.room.board.winnerIds,[g.room.players[0].id]);
});
test('gameplay reconnect keeps seat, pauses active turn, then skips after 30 seconds',()=>{
 const f=fixture(2);const p=f.room.players[0];f.rooms.disconnect(f.code,f.people[0]);f.rooms.sweep();assert.equal(f.room.board.pausedAt,f.now());
 f.advance(30_001);f.rooms.sweep();assert.equal(f.room.board.step,'result');assert.match(f.room.board.result.text,/skipped/);
 assert.equal(f.room.players.length,2);f.advance(4501);f.rooms.sweep();assert.equal(f.room.board.activeId,f.room.players[1].id);
 f.rooms.resume({code:f.code,role:'player',token:p.token,socketId:'back'});assert.equal(f.room.players[0].socketId,'back');
});
