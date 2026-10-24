'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {attachGateway} = require('../server/gateway');

class FakeSocket {
  constructor(id,ip='192.168.1.99') {this.id=id;this.events=new Map();this.out=[];this.rooms=new Set();this.handshake={address:ip};this.request={headers:{host:'localhost:3000'},secure:false};this.request.socket={remoteAddress:ip};}
  on(name,fn) {this.events.set(name,fn);}
  join(code) {this.rooms.add(code);}
  leave(code) {this.rooms.delete(code);}
  emit(name,payload) {this.out.push({name,payload});}
  async send(name,payload={}) {
    return new Promise(resolve=>{const handler=this.events.get(name);assert.ok(handler, `event ${name} exists`);handler(payload,resolve);});
  }
}
class FakeIO {
  constructor() {this.connections=null;this.sockets={sockets:new Map()};this.broadcasts=[];}
  on(name,handler) {assert.equal(name,'connection');this.connections=handler;}
  connect(socket) {this.sockets.sockets.set(socket.id,socket);this.connections(socket);return socket;}
  to(code) {return {emit:(name,payload)=>this.broadcasts.push({code,name,payload})};}
  in(code) {return {socketsLeave:()=>{for(const socket of this.sockets.sockets.values()) socket.leave(code);}};}
}
const fakeQRCode={toDataURL:async url=>`data:image/mock,${url}`};

test('socket gateway creates room, looks up code, adds two players, ready states and changes settings',async()=>{
  const io=new FakeIO();const gateway=attachGateway(io,{QRCode:fakeQRCode});
  try {
    const host=io.connect(new FakeSocket('tv'));
    const created=await host.send('room:create',{});
    assert.equal(created.ok,true);
    assert.match(created.joinUrl,/^http:\/\//);
    assert.match(created.qrDataUrl,/^data:/);
    const p1=io.connect(new FakeSocket('p1','192.168.1.1'));
    const p2=io.connect(new FakeSocket('p2','192.168.1.2'));
    const peek=await p1.send('room:peek',{code:created.code});
    assert.equal(peek.ok,true);
    const a=await p1.send('room:join',{code:created.code,name:'Alice',avatarId:1});
    const b=await p2.send('room:join',{code:created.code,name:'Bob',avatarId:2});
    assert.equal(a.ok,true);assert.equal(b.ok,true);
    const denied=await p2.send('room:settings',{patch:{rounds:10}});
    assert.equal(denied.code,'AUTH');
    assert.equal((await host.send('room:settings',{patch:{rounds:10}})).state.settings.rounds,10);
    assert.equal((await p1.send('room:ready',{ready:true})).state.canStart,false);
    assert.equal((await p2.send('room:ready',{ready:true})).state.canStart,true);
    assert.ok(io.broadcasts.filter(x=>x.name==='room:state').length>=5);
    assert.equal(JSON.stringify(io.broadcasts).includes(a.token),false);
  } finally {gateway.stop();}
});

test('socket gateway rejects room code guessing beyond rate limit',async()=>{
  const io=new FakeIO();const gateway=attachGateway(io,{QRCode:fakeQRCode});
  try {
    const phone=io.connect(new FakeSocket('p','192.168.1.1'));
    for(let i=0;i<12;i++)assert.equal((await phone.send('room:peek',{code:'AAAA'})).code,'ROOM');
    assert.equal((await phone.send('room:peek',{code:'AAAA'})).code,'RATE');
  } finally {gateway.stop();}
});

test('socket gateway resume takes over stale socket, and leaving frees avatar',async()=>{
  const io=new FakeIO();const gateway=attachGateway(io,{QRCode:fakeQRCode});
  try {
    const h=io.connect(new FakeSocket('tv'));
    const created=await h.send('room:create',{});
    const p=io.connect(new FakeSocket('p1'));
    const joined=await p.send('room:join',{code:created.code,name:'Alice',avatarId:3});
    const p2=io.connect(new FakeSocket('p2'));
    const resumed=await p2.send('room:resume',{code:created.code,token:joined.token,role:'player'});
    assert.equal(resumed.ok,true);
    assert.equal(p.out.find(x=>x.name==='room:session-replaced')?.name,'room:session-replaced');
    assert.equal((await p.send('room:ready',{ready:true})).code,'AUTH');
    assert.equal((await p2.send('room:leave',{})).ok,true);
    const next=io.connect(new FakeSocket('p3','192.168.1.10'));
    assert.equal((await next.send('room:join',{code:created.code,name:'Bob',avatarId:3})).ok,true);
  } finally {gateway.stop();}
});

test('gateway rejects oversized packets and cannot close room as a non-VIP player',async()=>{
  const io=new FakeIO();const gateway=attachGateway(io,{QRCode:fakeQRCode});
  try {
    const h=io.connect(new FakeSocket('tv'));
    const created=await h.send('room:create',{});
    const p=io.connect(new FakeSocket('p1'));
    await p.send('room:join',{code:created.code,name:'Alice',avatarId:1});
    const other=io.connect(new FakeSocket('p2'));
    await other.send('room:join',{code:created.code,name:'Bob',avatarId:2});
    assert.equal((await other.send('room:close',{})).code,'AUTH');
    assert.equal((await p.send('room:ready',{ready:true,extra:'X'.repeat(800)})).code,'INPUT');
    assert.equal((await h.send('room:close',{})).ok,true);
    assert.ok(io.broadcasts.some(x=>x.name==='room:closed'));
  } finally {gateway.stop();}
});

test('one TV and six independent Socket.IO gateway clients can join, ready and receive the same room state',async()=>{
  const io=new FakeIO();const gateway=attachGateway(io,{QRCode:fakeQRCode});
  try {
    const host=io.connect(new FakeSocket('tv'));
    const created=await host.send('room:create',{});
    const clients=[];
    for(let i=1;i<=6;i++) {
      const socket=io.connect(new FakeSocket('client'+i,'192.168.1.'+(40+i)));
      const result=await socket.send('room:join',{code:created.code,name:'Player'+i,avatarId:i});
      assert.equal(result.ok,true);
      clients.push(socket);
    }
    for(const socket of clients)assert.equal((await socket.send('room:ready',{ready:true})).ok,true);
    const actual=gateway.rooms.state(created.code);
    assert.equal(actual.players.length,6);
    assert.equal(actual.canStart,true);
    assert.ok(actual.players.every(p=>p.ready&&p.online));
    const latest=io.broadcasts.filter(x=>x.name==='room:state').at(-1);
    assert.equal(latest.payload.players.length,6);
    assert.equal(latest.payload.canStart,true);
  }finally{gateway.stop();}
});

test('Phase 2 gateway: VIP or TV host starts; players roll, choose and answer; secrets stay server-side',async()=>{
  const io=new FakeIO();const gateway=attachGateway(io,{QRCode:fakeQRCode});
  try{
    const host=io.connect(new FakeSocket('tv2','192.168.1.41'));
    const cr=await host.send('room:create',{});
    const alice=io.connect(new FakeSocket('alice','192.168.1.42'));
    const bob=io.connect(new FakeSocket('bob','192.168.1.43'));
    await alice.send('room:join',{code:cr.code,name:'Alice',avatarId:1});
    await bob.send('room:join',{code:cr.code,name:'Bob',avatarId:2});
    await alice.send('room:ready',{ready:true});await bob.send('room:ready',{ready:true});
    assert.equal((await host.send('room:settings',{patch:{roundStyle:'sequential'}})).ok,true);
    assert.equal((await bob.send('game:start',{})).code,'AUTH');
    assert.equal((await host.send('game:start',{})).state.phase,'board');
    assert.equal((await bob.send('game:roll',{})).code,'TURN');
    const r=await alice.send('game:roll',{});assert.equal(r.ok,true);
    assert.notEqual(r.state.board.step,'await_roll');
    assert.equal((await host.send('game:answer',{choice:0})).code,'AUTH');
    if(r.state.board.step==='choose_target'){
      const opponent=r.state.players.find(p=>p.name==='Bob');
      assert.equal((await alice.send('game:choose',{targetId:opponent.id})).ok,true);
    }
    if(r.state.board.step==='challenge'){
      assert.equal(r.state.board.challenge.correct,undefined);
      const answer=(await alice.send('game:answer',{choice:0}));assert.equal(answer.ok,true);
      // Brain Drain has a single participant, so the first answer resolves it.
      assert.equal((await alice.send('game:answer',{choice:0})).code,'STEP');
    }
    const last=io.broadcasts.filter(x=>x.name==='room:state').at(-1).payload;
    assert.equal(JSON.stringify(last).includes(gateway.rooms.find(cr.code).hostToken),false);
    assert.equal(last.board.challenge?.correct,undefined);
  }finally{gateway.stop();}
});

test('Phase 3 Socket.IO inputs authenticate by seat and keep TV count cues off every phone',async()=>{
  const {GameRooms}=require('./helpers/sequential-rooms');const games=require('../server/games/phase3');
  let now=10_000;const rooms=new GameRooms({now:()=>now,randomInt:n=>0});
  const io=new FakeIO(),gateway=attachGateway(io,{QRCode:fakeQRCode,rooms});
  try{
    const host=io.connect(new FakeSocket('tv'));const cr=await host.send('room:create',{});
    const a=io.connect(new FakeSocket('alice')),b=io.connect(new FakeSocket('bob'));
    await a.send('room:join',{code:cr.code,name:'Alice',avatarId:1});await b.send('room:join',{code:cr.code,name:'Bob',avatarId:2});
    await a.send('room:ready',{ready:true});await b.send('room:ready',{ready:true});await host.send('game:start',{});
    games.start(rooms.find(cr.code),'speed',now,()=>0,'count-flash');
    now+=5001;rooms.sweep();now+=2200;const model=rooms.find(cr.code).board.minigame;
    assert.equal((await host.send('game:input',{value:25,roundKey:model.roundKey})).code,'AUTH');
    assert.equal((await a.send('game:input',{value:model.secret.count,roundKey:0})).code,'STALE');
    assert.equal((await a.send('game:input',{value:model.secret.count,roundKey:model.roundKey})).ok,true);
    const lastFor=(sid)=>io.broadcasts.filter(e=>e.code===sid&&e.name==='room:state').at(-1).payload;
    assert(lastFor('tv').board.minigame.tvCue);
    for(const sock of ['alice','bob']){
      const json=JSON.stringify(lastFor(sock));assert(!json.includes('"tvCue"'));assert(!json.includes('"secret"'));
    }
  }finally{gateway.stop();}
});

test('Phase 4 gateway: player-specific private cards and secured live sketch strokes',async()=>{
 const {GameRooms}=require('./helpers/sequential-rooms');const games=require('../server/games/phase4');
 let now=10000;const rooms=new GameRooms({now:()=>now,randomInt:n=>0}),io=new FakeIO();
 const gateway=attachGateway(io,{QRCode:fakeQRCode,rooms});
 try{
  const host=io.connect(new FakeSocket('tv'));const cr=await host.send('room:create',{});
  const clients=[];
  for(let i=0;i<4;i++){
   const socket=io.connect(new FakeSocket('phone'+i));const r=await socket.send('room:join',{code:cr.code,name:'Contestant '+i,avatarId:i+1});
   clients.push(socket);assert.equal(r.ok,true);await socket.send('room:ready',{ready:true});
  }
  await host.send('game:start',{});
  games.start(rooms.find(cr.code),'create',now,()=>0,'sketch-sabotage');now+=5001;rooms.sweep();
  const m=rooms.find(cr.code).board.minigame,word=m.secret.word,sabIndex=rooms.find(cr.code).players.findIndex(p=>p.id===m.secret.saboteur);
  const latest=socketId=>io.broadcasts.filter(e=>e.code===socketId&&e.name==='room:state').at(-1).payload.board.minigame;
  const firstStroke=await clients[0].send('game:draw',{roundKey:m.roundKey,points:[[1,1],[2,2]]});
  assert.equal(firstStroke.ok,true);
  assert.equal(firstStroke.state.board.minigame.private.word,word);
  assert.equal(rooms.state(cr.code,true).board.minigame.private,undefined);
  for(let i=1;i<4;i++)assert.equal(rooms.state(cr.code,false,rooms.find(cr.code).players[i].id).board.minigame.private?.word,undefined);
  const guestIdx=[1,2,3].find(i=>i!==sabIndex);
  assert.equal((await clients[guestIdx].send('game:draw',{roundKey:m.roundKey,points:[[1,1],[2,2]]})).code,'ROLE');
  assert.equal((await clients[0].send('game:draw',{roundKey:m.roundKey,points:[[1,1],[2,2],[10,10]]})).ok,true);
  assert.equal(io.broadcasts.filter(e=>e.code==='tv'&&e.name==='game:stroke').length,2);
  assert.equal(rooms.state(cr.code,true).board.minigame.display.strokes.length,2);
  assert.equal((await clients[0].send('game:draw',{roundKey:m.roundKey,points:Array.from({length:250},(_,i)=>[i,i])})).code,'INPUT');
  assert.equal((await host.send('game:draw',{roundKey:m.roundKey,points:[[1,1],[2,2]]})).code,'AUTH');
 }finally{gateway.stop();}
});

test('Phase 6: eight phones behind one public IP may each peek and join the same room',async()=>{
 const io=new FakeIO();const gateway=attachGateway(io,{QRCode:fakeQRCode});
 try {
  const host=io.connect(new FakeSocket('tv-host','203.0.113.1'));
  const created=await host.send('room:create',{});assert.equal(created.ok,true);
  const clients=[];
  for(let i=0;i<8;i++){
    const phone=io.connect(new FakeSocket(`mobile-${i}`,'203.0.113.77'));
    const lookup=await phone.send('room:peek',{code:created.code});assert.equal(lookup.ok,true);
    const joined=await phone.send('room:join',{code:created.code,name:`Contestant ${i+1}`,avatarId:i+1});assert.equal(joined.ok,true);
    clients.push(phone);
  }
  assert.equal(gateway.rooms.state(created.code).players.length,8);
  for(const phone of clients)assert.equal((await phone.send('room:ready',{ready:true})).ok,true);
  assert.equal(gateway.rooms.state(created.code).canStart,true);
 }finally{gateway.stop();}
});

test('Phase 6: one TV and six gateway clients can finish a match and observe the winner',async()=>{
 const {GameRooms}=require('./helpers/sequential-rooms');let now=10_000;
 const rooms=new GameRooms({now:()=>now,randomInt:()=>0});
 const io=new FakeIO();const gateway=attachGateway(io,{QRCode:fakeQRCode,rooms});
 try{
  const tv=io.connect(new FakeSocket('tv-live'));
  const {code}=await tv.send('room:create',{});
  const phones=[];
  for(let i=0;i<6;i++){
    const socket=io.connect(new FakeSocket(`player-${i}`,'198.51.100.10'));
    assert.equal((await socket.send('room:join',{code,name:`Player ${i+1}`,avatarId:i+1})).ok,true);
    assert.equal((await socket.send('room:ready',{ready:true})).ok,true);phones.push(socket);
  }
  assert.equal((await tv.send('game:start',{})).ok,true);
  // Force a deterministic final lap, exercising genuine gateway roll,
  // server-owned landing, scoring, state broadcast, and completion.
  // Final round (Last Orders), last board turn of the round: land exactly on START.
  const room=rooms.find(code);const b=room.board;b.roundNo=b.totalRounds;b.turnInRound=room.players.length-1;
  room.players[0].position=27;room.players[0].sparks=11;
  b.turnStartSparks=Object.fromEntries(room.players.map(p=>[p.id,p.sparks]));
  const result=await phones[0].send('game:roll',{});
  assert.equal(result.ok,true);assert.equal(result.state.board.step,'result');
  assert.equal(result.state.players[0].sparks,15); // +2 for START, doubled by Last Orders
  now+=5000;rooms.sweep();
  assert.equal(b.stage,'round-game');assert.equal(b.step,'minigame');
  require('../server/board').finishTurn(room,now,'Final round game.',[]);
  now+=5000;for(const id of rooms.sweep()) if(id===code)io.to(code).emit('room:state',rooms.state(code,true));
  assert.equal(room.phase,'finished');
  assert.deepEqual(room.board.winnerIds,[room.players[0].id]);
  assert.equal(rooms.state(code).phase,'finished');
  assert(io.broadcasts.some(event=>event.name==='room:state'&&event.payload.phase==='board'));
 }finally{gateway.stop();}
});

test('accepted sketch strokes reach the host as compact events without full room broadcasts', async () => {
  const io = new FakeIO();
  const gateway = attachGateway(io, {QRCode:fakeQRCode});
  try {
    const host = io.connect(new FakeSocket('sketch-tv'));
    const created = await host.send('room:create', {});
    const artist = io.connect(new FakeSocket('sketch-artist'));
    await artist.send('room:join', {code:created.code, name:'Artist', avatarId:1});
    const viewer = io.connect(new FakeSocket('sketch-viewer'));
    await viewer.send('room:join', {code:created.code, name:'Viewer', avatarId:2});
    // Replace the game handler to isolate delivery from the game's random setup.
    gateway.rooms.drawGame = () => ({board:{minigame:{id:'sketch-sabotage',phase:'play',display:{strokes:[{points:[[0,0],[100,100]]}]}}}});
    const prior = io.broadcasts.length;
    const result = await artist.send('game:draw', {points:[[0,0],[100,100]],roundKey:7});
    assert.equal(result.ok,true);
    const events = io.broadcasts.slice(prior);
    assert.equal(events.filter(x=>x.name==='room:state').length,0);
    const strokes = events.filter(x=>x.name==='game:stroke');
    assert.equal(strokes.length,1);
    assert.equal(strokes[0].code,'sketch-tv');
    assert.deepEqual(strokes[0].payload,{code:created.code,roundKey:7,index:0,points:[[0,0],[100,100]]});
    assert.equal(JSON.stringify(strokes[0]).includes('players'),false);
  } finally {gateway.stop();}
});
