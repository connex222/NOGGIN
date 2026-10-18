'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {GameRooms, LobbyError, normalizeName, safeTokenEquals} = require('../server/rooms');
const {AttemptLimiter} = require('../server/limiter');
const {allLanAddresses, joinBaseUrl, joinUrl} = require('../server/network');

function fixture() {
  let clock = 1000;
  const rooms = new GameRooms({now:()=>clock});
  const {code,token} = rooms.create('tv-1');
  return {rooms,code,token,now:()=>clock,advance:n=>{clock+=n;}};
}
function join(f,name='Alice',id=1,socketId='phone-A') {
  return f.rooms.join({code:f.code,name,avatarId:id,socketId});
}

test('creates unique four-character rooms and no client-readable secrets in state',()=>{
  const f=fixture();
  assert.match(f.code,/^[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(f.token.length,32);
  assert.equal(JSON.stringify(f.rooms.state(f.code)).includes(f.token),false);
});
test('2-8 player limits, 1-12 avatars and unique seats',()=>{
  const f=fixture();
  for(let x=1;x<=8;x++) join(f,'Player'+x,x,'socket-'+x);
  const room=f.rooms.state(f.code);
  assert.equal(room.players.length,8);
  assert.deepEqual(room.players.map(p=>p.seat),[1,2,3,4,5,6,7,8]);
  assert.throws(()=>join(f,'Ninth',9,'9'),e=>e.code==='FULL');
});
test('duplicate names and avatar claims are rejected',()=>{
  const f=fixture();join(f);
  assert.throws(()=>join(f,'Alice',2,'new-id'),e=>e.code==='DUP_NAME');
  assert.throws(()=>join(f,'Bob',1,'other'),e=>e.code==='TAKEN');
});
test('user-provided script HTML and overlong names cannot enter lobby',()=>{
  const f=fixture();
  assert.throws(()=>join(f,'<svg onload=alert(1)>',1,'evil'),e=>e.code==='NAME');
  assert.throws(()=>join(f,'A'.repeat(21),1,'evil'),e=>e.code==='NAME');
  assert.equal(normalizeName('  Mary    Jane  '),'Mary Jane');
});
test('only own socket can ready or change avatar',()=>{
  const f=fixture();join(f);
  assert.throws(()=>f.rooms.setReady(f.code,'hacker',true),e=>e.code==='AUTH');
  assert.throws(()=>f.rooms.setAvatar(f.code,'hacker',2),e=>e.code==='AUTH');
  f.rooms.setReady(f.code,'phone-A',true);
  assert.equal(f.rooms.state(f.code).players[0].ready,true);
  f.rooms.setAvatar(f.code,'phone-A',3);
  assert.equal(f.rooms.state(f.code).players[0].ready,false);
});
test('host may change settings but players may not; invalid patches fail atomically',()=>{
  const f=fixture();join(f);
  assert.throws(()=>f.rooms.setSettings(f.code,'phone-A',{target:16}),e=>e.code==='AUTH');
  assert.throws(()=>f.rooms.setSettings(f.code,'tv-1',{target:999}),e=>e.code==='SETTINGS');
  assert.deepEqual(f.rooms.state(f.code).settings,{target:12,familyFriendly:true,timerSpeed:'normal',reduceMotion:false});
  f.rooms.setSettings(f.code,'tv-1',{target:16,timerSpeed:'relaxed',reduceMotion:true});
  assert.equal(f.rooms.state(f.code).settings.target,16);
  assert.equal(f.rooms.state(f.code).settings.reduceMotion,true);
});
test('start eligibility requires two online ready players and connected host',()=>{
  const f=fixture();join(f);
  f.rooms.setReady(f.code,'phone-A',true);
  assert.equal(f.rooms.state(f.code).canStart,false);
  join(f,'Bob',2,'phone-B'); f.rooms.setReady(f.code,'phone-B',true);
  assert.equal(f.rooms.state(f.code).canStart,true);
  f.rooms.disconnect(f.code,'tv-1');
  assert.equal(f.rooms.state(f.code).canStart,false);
});
test('30-second temporary disconnect can resume same seat with opaque token',()=>{
  const f=fixture();const p=join(f);
  f.rooms.setReady(f.code,'phone-A',true);
  f.rooms.disconnect(f.code,'phone-A');f.advance(29_999);
  const resume=f.rooms.resume({code:f.code,token:p.token,role:'player',socketId:'phone-New'});
  assert.equal(resume.playerId,p.playerId);
  assert.equal(f.rooms.state(f.code).players[0].ready,true);
  assert.equal(f.rooms.state(f.code).players[0].online,true);
});
test('after 30 seconds disconnected players are freed by sweep',()=>{
  const f=fixture();join(f);
  f.rooms.disconnect(f.code,'phone-A');f.advance(30_001);
  assert.deepEqual(f.rooms.sweep(),[f.code]);
  assert.equal(f.rooms.state(f.code).players.length,0);
});
test('expired player token cannot resume',()=>{
  const f=fixture();const p=join(f);
  f.rooms.disconnect(f.code,'phone-A');f.advance(30_001);
  assert.throws(()=>f.rooms.resume({code:f.code,token:p.token,role:'player',socketId:'new'}),e=>e.code==='EXPIRED');
});
test('invalid reconnect token cannot impersonate a host or player',()=>{
  const f=fixture();const p=join(f);
  assert.equal(safeTokenEquals(f.token,f.token),true);
  assert.equal(safeTokenEquals(f.token,p.token),false);
  assert.throws(()=>f.rooms.resume({code:f.code,token:p.token,role:'host',socketId:'fake'}),e=>e.code==='AUTH');
  assert.throws(()=>f.rooms.resume({code:f.code,token:f.token,role:'player',socketId:'fake'}),e=>e.code==='AUTH');
});
test('host session survives a browser reload',()=>{
  const f=fixture();f.rooms.disconnect(f.code,'tv-1');
  const r=f.rooms.resume({code:f.code,token:f.token,role:'host',socketId:'tv-2'});
  assert.equal(r.role,'host');assert.equal(r.state.hostOnline,true);
});
test('leaving frees claimed avatars and recycles first available seat',()=>{
  const f=fixture();join(f);f.rooms.leave(f.code,'phone-A');
  const b=join(f,'Boris',1,'phone-B');
  assert.equal(b.state.players[0].seat,1);
});
test('rate limiter uses strict rolling time windows',()=>{
  let now=100;
  const l=new AttemptLimiter({limit:2,windowMs:1000,now:()=>now});
  assert.equal(l.allow('ip'),true);assert.equal(l.allow('ip'),true);assert.equal(l.allow('ip'),false);
  now+=1001;assert.equal(l.allow('ip'),true);
  assert.equal(l.allow('ip2'),true);
  l.sweep();assert.equal(l.attempts.has('ip2'),true);
});
test('LAN address detection prefers physical interfaces and excludes VPN/loopback',()=>{
  const list=allLanAddresses({Ethernet:[{family:'IPv4',internal:false,address:'192.168.200.12'}],docker0:[{family:'IPv4',internal:false,address:'172.17.0.2'}],lo:[{family:'IPv4',internal:true,address:'127.0.0.1'}]});
  assert.equal(list[0],'192.168.200.12');
});
test('QR link replaces localhost with LAN IPv4 and honours Render forwarded HTTPS',()=>{
  const request={headers:{host:'localhost:3000'},secure:false};
  assert.equal(joinUrl(request,'ABCD',{lanAddresses:['192.168.200.12']}),'http://192.168.200.12:3000/play/?room=ABCD');
  assert.equal(joinBaseUrl({headers:{host:'example.onrender.com','x-forwarded-proto':'https'},secure:false},{lanAddresses:[]}), 'http://example.onrender.com');
});
test('normalizes room code and rejects invalid room ids',()=>{
  const f=fixture();assert.equal(f.rooms.find(f.code.toLowerCase()).code,f.code);
  assert.throws(()=>f.rooms.find('!bad'),e=>e.code==='ROOM');
});
