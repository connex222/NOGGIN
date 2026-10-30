'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {GameRooms, LOBBY_GRACE_MS, SEAT_GRACE_MS}=require('../server/rooms');

test('D4: disconnected ready lobby seat remains for ten minutes, then expires',()=>{
 let now=1_000_000;
 const rooms=new GameRooms({now:()=>now});
 const code=rooms.create('tv').code;
 const avatars=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/shared/avatars.json'),'utf8'));
 const ids=avatars.map(x=>x.id);
 assert.ok(ids.length>=2);
 rooms.join({code,name:'Player One',avatarId:ids[0],socketId:'phone1'});
 rooms.join({code,name:'Player Two',avatarId:ids[1],socketId:'phone2'});
 rooms.setReady(code,'phone1',true);
 rooms.setReady(code,'phone2',true);
 rooms.disconnect(code,'phone2');
 assert.equal(rooms.state(code,true).canStart,true,'offline-ready players do not block launch');
 now+=LOBBY_GRACE_MS-1;
 rooms.sweep();
 assert.equal(rooms.find(code).players.length,2,'seat held during grace');
 now+=2;
 rooms.sweep();
 assert.equal(rooms.find(code).players.length,1,'seat released after ten minutes');
 assert.equal(SEAT_GRACE_MS,30_000,'active game reconnect period remains thirty seconds');
});

test('D3/D13: restart warning, health ping and private-storage guards are present',()=>{
 const tv=fs.readFileSync(path.join(__dirname,'../public/tv/tv.js'),'utf8');
 const phone=fs.readFileSync(path.join(__dirname,'../public/play/play.js'),'utf8');
 const client=fs.readFileSync(path.join(__dirname,'../public/shared/client.js'),'utf8');
 const audio=fs.readFileSync(path.join(__dirname,'../public/tv/sound.js'),'utf8');
 assert.match(tv,/The game server restarted/);
 assert.match(tv,/fetch\('\/health'/);
 assert.match(phone,/wakeLock\.request\('screen'\)/);
 assert.match(phone,/visibilitychange/);
 assert.match(phone,/The game was reset on the TV/);
 assert.match(client,/try\s*\{return localStorage/);
 assert.match(audio,/try\s*\{return localStorage/);
});

test('D5: ordinary games continue and host-critical games hand over',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../server/board.js'),'utf8');
 for(const id of ['sketch-sabotage','noise-annoys','mind-meld','bomb-squad'])assert.ok(src.includes("'"+id+"'"));
 assert.match(src,/function hostCanBeOffline/);
 assert.match(src,/function handOverHost/);
 assert.match(src,/handOverHost\(room, now, rng\)/);
 assert.match(src,/phase4\.start\(room, category, now, rng, id\)/);
});
