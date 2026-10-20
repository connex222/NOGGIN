'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {GameRooms} = require('../server/rooms');

test('VIP is first contestant; only VIP and TV host can act; handover occurs after thirty seconds', () => {
  let time = 50_000;
  const rooms = new GameRooms({now: () => time});
  const {code} = rooms.create('tv');
  const alice = rooms.join({code, name:'Alice', avatarId:1, socketId:'a'});
  const bob = rooms.join({code, name:'Bob', avatarId:2, socketId:'b'});
  assert.equal(rooms.state(code).vipId,alice.playerId);
  assert.throws(() => rooms.setSettings(code,'b',{target:12}),{code:'AUTH'});
  assert.equal(rooms.setSettings(code,'a',{target:12}).settings.target,12);
  assert.equal(rooms.setSettings(code,'tv',{target:16}).settings.target,16);
  rooms.disconnect(code,'a');
  time += 29_999;
  rooms.sweep();
  assert.equal(rooms.state(code).vipId,alice.playerId);
  time += 1;
  rooms.sweep();
  assert.equal(rooms.state(code).vipId,bob.playerId);
  assert.throws(() => rooms.setSettings(code,'a',{target:12}),{code:'AUTH'});
  assert.equal(rooms.setSettings(code,'b',{target:12}).settings.target,12);
  rooms.resume({code,token:alice.token,socketId:'a-rejoined',role:'player'});
  assert.equal(rooms.state(code).vipId,bob.playerId);
  assert.throws(() => rooms.setSettings(code,'a-rejoined',{target:16}),{code:'AUTH'});
});
