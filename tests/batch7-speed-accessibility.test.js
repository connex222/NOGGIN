'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {GameRooms}=require('./helpers/sequential-rooms');
const phase3=require('../server/games/phase3');
const phase5=require('../server/games/phase5');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function game(id,accessible=false){
 let now=100000;
 const rooms=new GameRooms({now:()=>now,randomInt:()=>0});
 const {code}=rooms.create('tv');
 for(let i=0;i<2;i++){
   rooms.join({code,name:'Player '+i,avatarId:i+1,socketId:'phone'+i});
   rooms.setReady(code,'phone'+i,true);
 }
 if(accessible) rooms.setSettings(code,'tv',{colourBlindSafe:true});
 rooms.startGame(code,'tv');
 const room=rooms.find(code);
 phase3.start(room,'speed',now,()=>0,id);
 return {rooms,code,room,now:()=>now,at:t=>{now=t;rooms.sweep();},m:()=>room.board.minigame,
   send:(i,value)=>rooms.inputGame(code,'phone'+i,value,room.board.minigame.roundKey)};
}
test('D7: server rejects Quick Draw early taps and ranks a later-arriving faster reaction correctly',()=>{
 const f=game('quick-draw');
 f.at(f.m().openAt-1500);
 assert.throws(()=>f.send(0,{value:1,reactionMs:180}),e=>['WAIT','EARLY','INPUT'].includes(e.code));
 const open=f.m().openAt;
 f.at(open+900);
 f.send(0,{value:1,reactionMs:560});
 f.at(open+1050);
 f.send(1,{value:1,reactionMs:240});
 const m=f.m();
 assert.ok(m.roundAnswers);
 assert.equal(m.roundAnswers[f.room.players[0].id].reactionMs,560);
 assert.equal(m.roundAnswers[f.room.players[1].id].reactionMs,240);
});
test('D7: Buzzer Battle keeps a 150 ms collection window and compares claimed reactions',()=>{
 let now=1000;
 const rooms=new GameRooms({now:()=>now,randomInt:()=>0});
 const {code}=rooms.create('tv');
 for(let i=0;i<2;i++){rooms.join({code,name:'Player '+i,avatarId:i+1,socketId:'p'+i});rooms.setReady(code,'p'+i,true);}
 rooms.startGame(code,'tv');
 const room=rooms.find(code);room.board.landing=6;
 phase5.start(room,'corner',now,room.players[1].id,()=>0);
 now+=5001;rooms.sweep();
 const m=room.board.showdown;
 assert.equal(m.phase,'buzz');
 rooms.inputGame(code,'p0',{action:'buzz',reactionMs:460},m.roundKey);
 assert.equal(m.phase,'buzz');
 assert.equal(m.buzzWindowUntil-now,150);
 now+=80;
 rooms.inputGame(code,'p1',{action:'buzz',reactionMs:210},m.roundKey);
 assert.equal(m.buzzId,room.players[1].id,'faster phone wins despite later network arrival');
});
test('D8: Shape Clash uses shapes rather than relying on red versus green',()=>{
 const f=game('colour-clash',true);
 assert.equal(f.room.settings.colourBlindSafe,true);
 const m=f.m();
 assert.equal(m.display.mode,'shape');
 assert.ok(['CIRCLE','SQUARE','TRIANGLE','STAR'].includes(m.display.shape));
 assert.notEqual(m.display.shape,m.display.word);
 const state=f.rooms.state(f.code,true);
 assert.equal(state.settings.colourBlindSafe,true);
 assert.equal(state.board.minigame.display.mode,'shape');
 const phone=read('public/play/play.js');
 const tv=read('public/tv/board-view.js');
 assert.match(phone,/function shapeSvg\(shape,word\)/);
 assert.match(tv,/shapeSvg\(shape,word\)/);
 assert.match(phone,/shape\.toLowerCase\(\)/);
});
