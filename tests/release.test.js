'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const board=require('../server/board');
const {AttemptLimiter}=require('../server/limiter');

function fixture(n) {
 const players=Array.from({length:n},(_,i)=>({id:'p'+i,name:'Player '+(i+1),seat:i+1,ready:true,socketId:'s'+i,sparks:0,position:0}));
 const room={phase:'lobby',hostSocketId:'host',settings:{target:12,timerSpeed:'normal'},players};
 board.start(room);return room;
}
test('release underdog bonus: behind three Sparks at turn start earns one at four players',()=>{
 const room=fixture(4);room.players[1].sparks=5;
 room.board.turnStartSparks=Object.fromEntries(room.players.map(p=>[p.id,p.sparks]));
 // The minigame already awarded p0 a point; finishing should add another.
 room.players[0].sparks++;
 board.finishTurn(room,1234,'Game finished',[room.players[0].id]);
 assert.equal(room.players[0].sparks,2);
 assert.deepEqual(room.board.result.underdogs,[room.players[0].id]);
 assert.match(room.board.result.text,/Underdog boost/);
});
test('release underdog bonus: two in eight player match and no bonus for passive special spaces',()=>{
 const room=fixture(8);room.players[5].sparks=5;room.board.turnStartSparks=Object.fromEntries(room.players.map(p=>[p.id,p.sparks]));
 room.players[0].sparks++;
 board.finishTurn(room,1234,'Showdown',[room.players[0].id]);
 assert.equal(room.players[0].sparks,3);
 const next=fixture(8);next.players[5].sparks=5;next.board.turnStartSparks=Object.fromEntries(next.players.map(p=>[p.id,p.sparks]));
 board.finishTurn(next,1234,'Picked up a Spark',[]);
 assert.equal(next.players[0].sparks,0);
});
test('release underdog bonus: two-player comeback is separate from the 4+ player underdog bonus',()=>{
 const duo=fixture(2);duo.players[1].sparks=7;
 duo.board.turnStartSparks=Object.fromEntries(duo.players.map(p=>[p.id,p.sparks]));
 duo.players[0].sparks=1;board.finishTurn(duo,1234,'Played',[duo.players[0].id]);assert.equal(duo.players[0].sparks,3);
 const four=fixture(4);four.players[1].sparks=2;four.board.turnStartSparks=Object.fromEntries(four.players.map(p=>[p.id,p.sparks]));
 four.players[0].sparks=1;board.finishTurn(four,1234,'Played',[four.players[0].id]);assert.equal(four.players[0].sparks,1);
});
test('release rate limiter supports separate host, join and peek allowances',()=>{
 const limiter=new AttemptLimiter({now:()=>1000});
 for(let i=0;i<8;i++){assert(limiter.allow('a:join',32));assert(limiter.allow('a:peek',12));}
 for(let i=8;i<12;i++)assert(limiter.allow('a:peek',12));
 assert.equal(limiter.allow('a:peek',12),false);
 for(let i=0;i<4;i++)assert(limiter.allow('a:create',4));
 assert.equal(limiter.allow('a:create',4),false);
});
test('release guide uses board and catalogs, no manual retyping of game list',()=>{
 const txt=execFileSync(process.execPath,[path.join(__dirname,'../tools/export-guide-data.js')],{encoding:'utf8'});
 const guide=JSON.parse(txt);
 assert.equal(guide.boardSpaces,board.SPACES.length);
 assert.equal(guide.avatars,12);
 assert.equal(guide.catchUp.threshold,board.UNDERDOG_THRESHOLD);
 assert.deepEqual(Object.values(guide.categories).map(x=>x.length),[4,4,4,4]);
 assert.equal(guide.showdowns.length,4);
});
test('release ZIP required hosting, docs and all runtime avatars are present',()=>{
 const root=path.join(__dirname,'..');
 for(const name of ['Dockerfile','docker-compose.yml','render.yaml','start-noggin.bat','INSTALL.md','HOW-TO-PLAY.pdf','deploy/oracle/Caddyfile','.github/workflows/ci.yml']){
  assert.ok(fs.statSync(path.join(root,name)).size>0,name);
 }
 const avatars=fs.readdirSync(path.join(root,'public/avatars/thumbs')).filter(x=>x.endsWith('.webp'));
 assert.ok(avatars.length>=36);
 assert.equal(fs.readdirSync(path.join(root,'public/avatars/thumbs')).filter(x=>x.endsWith('.png')).length,0);
});
