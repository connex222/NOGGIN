'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const board=require('../server/board');
const {GameRooms}=require('./helpers/sequential-rooms');
const store=require('../server/state-store');

test('host reconnection shifts TV movement and reveal cues together with result timers',()=>{
 const room={
   players:[{id:'one',offlineSince:null}],
   board:{
     pausedAt:2000,pauseKind:'host',pauseReason:'offline',
     deadline:12000,nextAt:16000,presentUntil:15000,
     explainer:{until:6000},standings:{until:8000},
     challenge:{deadline:9000},showdown:{deadline:10000,openAt:4000,hardStop:24000},
     minigame:{deadline:13000,openAt:3000,introUntil:4500,stageStarted:3200,display:{flashEndsAt:4700,revealAt:5600}}
   }
 };
 const shifted=board.resumeClocks(room,5000);
 assert.equal(shifted,3000);
 const b=room.board;
 assert.equal(b.nextAt,19000);
 assert.equal(b.presentUntil,18000);
 assert.equal(b.explainer.until,9000);
 assert.equal(b.standings.until,11000);
 assert.equal(b.challenge.deadline,12000);
 assert.equal(b.showdown.hardStop,27000);
 assert.equal(b.minigame.display.flashEndsAt,7700);
 assert.equal(b.pausedAt,null);
 assert.equal(board.resumeClocks(room,6000),0,'second resume cannot extend clocks');
});

test('checkpoint restore shifts presentation and Last Orders cue times and keeps rooms paused',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'noggin-flagship-checkpoint-'));
 const file=path.join(dir,'game.json');
 try{
   const rooms=new GameRooms({now:()=>1000,randomInt:()=>0});
   const {code}=rooms.create('tv');
   const r=rooms.find(code);
   r.phase='board';
   r.board={
     step:'result',stage:'board',nextAt:4500,deadline:null,presentUntil:3600,
     pausedAt:null,explainer:{until:2900},standings:{until:3000}
   };
   store.save(rooms,file,1000);
   const restored=new GameRooms({now:()=>3000,randomInt:()=>0});
   assert.equal(store.restore(restored,file,3000),1);
   const b=restored.find(code).board;
   assert.equal(b.nextAt,6500);
   assert.equal(b.presentUntil,5600);
   assert.equal(b.explainer.until,4900);
   assert.equal(b.standings.until,5000);
   assert.equal(b.pausedAt,3000);
   assert.equal(b.pauseKind,'host');
 }finally{
   fs.rmSync(dir,{recursive:true,force:true});
 }
});
