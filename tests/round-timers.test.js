'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {GameRooms}=require('./helpers/sequential-rooms');const games=require('../server/games/phase3');
for(const id of Object.keys(games.SPECS)){
  for(const timerSpeed of ['normal','relaxed']){
    test(`${id} (${timerSpeed}) round deadline is under 30 seconds`,()=>{
      let t=100_000;const rooms=new GameRooms({now:()=>t,randomInt:()=>0});const {code}=rooms.create('tv');
      for(let i=0;i<3;i++){rooms.join({code,name:'Player '+i,avatarId:i+1,socketId:'p'+i});rooms.setReady(code,'p'+i,true);}
      rooms.startGame(code,'tv');const room=rooms.find(code);room.settings.timerSpeed=timerSpeed;
      games.start(room,games.SPECS[id].category,t,()=>0,id);
      t+=8000;rooms.sweep();
      const m=room.board.minigame;
      assert.ok(m.deadline-t<30_000,`${id} round lasts ${(m.deadline-t)/1000}s`);
    });
  }
}
