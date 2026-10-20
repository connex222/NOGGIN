'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {GameRooms}=require('./helpers/sequential-rooms');
const phase4=require('../server/games/phase4');
const phase5=require('../server/games/phase5');
function game(n=4){
 let time=10000;const gr=new GameRooms({now:()=>time,randomInt:()=>0});const {code}=gr.create('tv');const sockets=[];
 for(let i=0;i<n;i++){let s='p'+i;sockets.push(s);gr.join({code,name:'Player '+i,avatarId:i+1,socketId:s});gr.setReady(code,s,true);}
 gr.setSettings(code,'tv',{rules:'showtime'});gr.startGame(code,'tv');return {gr,room:gr.find(code),code,sockets,now:()=>time};
}
test('two-player random game selection never chooses forced draw-only social games',()=>{
 for(const category of ['create','together']){
  const ids=new Set();for(let i=0;i<16;i++){
    const f=game(2);
    const m=phase4.start(f.room,category,10000,x=>i%x);
    ids.add(m.id);
    assert(!['caption-this','majority-rules'].includes(m.id),m.id);
  }
  assert(ids.size>1,`${category}: should still have multiple mini-games`);
 }
});
test('four-player random rotation still includes caption and majority games',()=>{
 const f=game(4),id=f.room.board;
 const all=[];
 for(const category of ['create','together']){
  for(let i=0;i<4;i++)all.push(phase4.chooseGame(id,category,()=>0,4));
 }
 assert(all.includes('caption-this'));
 assert(all.includes('majority-rules'));
});
test('showdown audience cheers are one-per-person, private by voter, non-scoring and server owned',()=>{
 const f=game(4),players=f.room.players;
 f.room.board.landing=7;phase5.start(f.room,'corner',f.now(),players[1].id,()=>0);
 const before=players.map(p=>p.sparks);
 assert.throws(()=>f.gr.cheerGame(f.code,f.sockets[0],players[1].id),e=>e.code==='ROLE');
 assert.throws(()=>f.gr.cheerGame(f.code,f.sockets[2],players[2].id),e=>e.code==='TARGET');
 const st=f.gr.cheerGame(f.code,f.sockets[2],players[1].id);
 assert.deepEqual(players.map(p=>p.sparks),before);
 assert.equal(st.board.showdown.myCheer,players[1].id);
 assert.equal(st.board.showdown.cheerCounts[players[1].id],1);
 assert.equal(f.gr.state(f.code,false,players[3].id).board.showdown.myCheer,undefined);
 assert.throws(()=>f.gr.cheerGame(f.code,f.sockets[2],players[0].id),e=>e.code==='VOTED');
 f.gr.cheerGame(f.code,f.sockets[3],players[0].id);
 assert.equal(f.gr.state(f.code,true).board.showdown.cheerCounts[players[0].id],1);
 assert.deepEqual(players.map(p=>p.sparks),before);
});
test('audience cannot cheer in NOGGIN-OFF or without a running showdown',()=>{
 const f=game(4);const p=f.room.players;
 assert.throws(()=>f.gr.cheerGame(f.code,f.sockets[2],p[0].id),e=>e.code==='STEP');
 f.room.board.finalists=[p[0].id,p[1].id];phase5.start(f.room,'tiebreak',f.now(),null,()=>0);
 assert.throws(()=>f.gr.cheerGame(f.code,f.sockets[2],p[0].id),e=>e.code==='STEP');
});

test('Bomb Squad gives every player private deduction scraps for 2–8 players',()=>{
 for(const n of [2,3,4,5,6,7,8]){
  const ids=Array.from({length:n},(_,i)=>'p'+i);
  const b=phase4.makeBomb(ids,x=>0);
  assert.deepEqual(b.colours.slice().sort(),['BLUE','GREEN','RED','YELLOW']);
  assert.equal(b.digits.length,4);
  for(const id of ids)assert(b.privateById[id].clues.length>0,`No clue for ${id} in ${n}-player room`);
  const all=ids.flatMap(id=>b.privateById[id].clues).join(' ');
  for(const word of ['FIRST','AFTER','LAST','FOURTH'])assert(all.includes(word));
  // Wire puzzle supplies information about all 4 wires without publishing the
  // ordered sequence directly on a public display or player phone.
  assert(!Object.values(b.privateById).some(v=>v.clues.join(' ').includes(b.colours.join(' → '))));
 }
});
const {containsBlockedText}=require('../server/content-filter');
test('family language filter uses whole words and avoids blocking innocent substrings',()=>{
 assert(containsBlockedText('What the FUCK?'));
 assert(containsBlockedText('That is shit'));
 assert(!containsBlockedText('Scunthorpe'));
 assert(!containsBlockedText('a classic ship'));
});
test('family rooms reject obvious adult-language player names; relaxed rooms permit adult language',()=>{
 const family=new GameRooms({now:()=>1000,randomInt:()=>0});const room=family.create('host');
 assert.throws(()=>family.join({code:room.code,name:'Shitty Sam',avatarId:3,socketId:'new'}),e=>e.code==='FAMILY');
 // Change the settings before starting a new room.
 let t=1000;const gr=new GameRooms({now:()=>t,randomInt:()=>0});const {code}=gr.create('host');
 gr.setSettings(code,'host',{familyFriendly:false});
 const result=gr.join({code,name:'Shitty Sam',avatarId:1,socketId:'new'});
 assert(result.playerId);
});
test('family rooms reject rude captions and do not mutate game state',()=>{
 const f=game(3);phase4.start(f.room,'create',f.now(),()=>0,'caption-this');
 f.room.board.minigame.phase='play';f.room.board.minigame.deadline=30000;
 assert.throws(()=>f.gr.inputGame(f.code,f.sockets[1],'fuck the judges',f.room.board.minigame.roundKey),e=>e.code==='FAMILY');
 assert.equal(Object.keys(f.room.board.minigame.answers).length,0);
});
