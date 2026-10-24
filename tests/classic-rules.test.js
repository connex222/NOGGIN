'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {GameRooms}=require('./helpers/sequential-rooms');
const phase3=require('../server/games/phase3');
const phase5=require('../server/games/phase5');
function game(mode='classic',n=4){let now=50000;const rooms=new GameRooms({now:()=>now,randomInt:()=>0});const {code}=rooms.create('tv');
 if(mode!=='classic')rooms.setSettings(code,'tv',{rules:mode});
 for(let i=0;i<n;i++){rooms.join({code,name:'Player '+i,avatarId:i+1,socketId:'p'+i});rooms.setReady(code,'p'+i,true);}
 rooms.startGame(code,'tv');return {rooms,code,room:rooms.find(code),now:()=>now};}
test('Classic is the default; Showtime must be explicitly selected by the host',()=>{
 const f=game();assert.equal(f.room.settings.rules,'classic');assert(f.room.players.every(p=>p.cues===0));
 assert.throws(()=>f.rooms.setSettings(f.code,'tv',{rules:'surprise'}),{code:'PHASE'});
 const q=new GameRooms(),{code}=q.create('tv');assert.throws(()=>q.setSettings(code,'tv',{rules:'invalid'}),{code:'SETTINGS'});
 q.setSettings(code,'tv',{rules:'showtime'});assert.equal(q.find(code).settings.rules,'showtime');
});
test('Classic rejects Director Cues and Plan a Landing (even crafted network requests); Headline Bets no longer exist',()=>{
 const f=game();const id='p0';f.room.players[0].sparks=5;f.room.players[0].cues=2;
 for(const action of ['director','normal'])assert.throws(()=>f.rooms.chooseGame(f.code,id,{action}),{code:'RULES'});
 for(const action of ['headline','safe'])assert.throws(()=>f.rooms.chooseGame(f.code,id,{action}),{code:'STEP'});
 assert.equal(f.room.board.routePlan,false);assert.equal(f.room.board.headline,undefined);
 f.room.players[1].sparks=8;f.rooms.rollGame(f.code,id);
 assert.notEqual(f.room.board.step,'choose_die');assert.notEqual(f.room.board.step,'choose_route');
 assert.equal(f.room.board.lastMove.die,1);
});
test('Classic cannot gain a Director Cue from a win, and cannot make Spotlight Picks',()=>{
 const f=game();f.room.players[0].cues=0;
 require('../server/board').finishTurn(f.room,f.now(),'won',[f.room.players[0].id]);
 assert.equal(f.room.players[0].cues,0);
 f.room.board.landing=6;phase5.start(f.room,'corner',f.now(),f.room.players[1].id,()=>0);
 assert.equal(f.rooms.state(f.code).board.showdown.cheerOpen,false);
 assert.throws(()=>f.rooms.cheerGame(f.code,'p2',f.room.players[0].id),{code:'RULES'});
});
test('Classic Count Flash shows the target before the flash ends',()=>{
 const f=game();phase3.start(f.room,'speed',f.now(),()=>0,'count-flash');
 const m=f.room.board.minigame;
 assert.equal(m.display.targetIcon,m.secret.targetIcon);
 assert.match(m.question,/COUNT THE/);
 assert.doesNotMatch(phase3.publicState(f.room).rule,/SURPRISE TARGET/);
 assert.doesNotMatch(f.room.board.event.text,/SURPRISE TARGET/);
});
test('Classic final Memory Lane round does not reverse the answer sequence',()=>{
 const f=game();phase3.start(f.room,'brain',f.now(),()=>0,'memory-lane');
 const m=f.room.board.minigame;m.round=phase3.SPECS['memory-lane'].rounds-1;
 phase3.nextRound(f.room,f.now(),()=>0);
 assert.equal(m.display.reverse,false);
 assert.doesNotMatch(m.question,/REVERSE/);
 assert.doesNotMatch(phase3.publicState(f.room).rule,/BACKWARDS/);
 const g=game('showtime');phase3.start(g.room,'brain',g.now(),()=>0,'memory-lane');
 const show=g.room.board.minigame;show.round=4;
 phase3.nextRound(g.room,g.now(),()=>0);assert.equal(show.display.reverse,true);
});
test('Odd Spot phone receives matching visual grid but never a separate answer index',()=>{
 const f=game();phase3.start(f.room,'speed',f.now(),()=>0,'odd-spot');
 const tv=f.rooms.state(f.code,true).board.minigame;
 const phone=f.rooms.state(f.code,false,f.room.players[0].id).board.minigame;
 assert.equal(tv.display.grid.length,36);assert.deepEqual(phone.display,tv.display);
 assert.equal(JSON.stringify(phone).includes('"index"'),false);
});
