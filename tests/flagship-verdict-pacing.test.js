'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const board = require('../server/board');

function fixture({relaxed=false, final=false, roundGame=false, presentation=0}={}) {
  const players=[{id:'one',name:'One',seat:1,sparks:2,cues:0},{id:'two',name:'Two',seat:2,sparks:2,cues:0}];
  const room={
    players,
    settings:{rules:'classic',timerSpeed:relaxed?'relaxed':'normal',roundStyle:'everyone'},
    board:{
      stage:roundGame?'round-game':'board',roundNo:final?6:1,totalRounds:6,
      turn:1,activeId:'one',turnStartSparks:{one:2,two:2},history:[],
      presentUntil:presentation?10000+presentation:null,
      result:null,deadline:null,nextAt:null
    }
  };
  return room;
}
function verdict(room, winners=[]) {
  board.finishTurn(room,10000,'A result',winners);
  return room.board.nextAt-10000;
}

test('empty landing verdict takes 1.3 seconds, not the old 2.9 seconds',()=>{
  const room=fixture();
  assert.equal(verdict(room),1300);
  assert.deepEqual(room.board.result.deltas,{});
});

test('ordinary +1 or +2 Spark change receives a readable 2-second verdict',()=>{
  const room=fixture();
  room.players[0].sparks+=1;
  assert.equal(verdict(room),2000);
  assert.equal(room.board.result.deltas.one,1);
});

test('significant score swings and round-game winner keep a full payoff',()=>{
  const big=fixture();
  big.players[0].sparks+=3;
  assert.equal(verdict(big),2900);
  const win=fixture({roundGame:true});
  assert.equal(verdict(win,['one']),2900);
  assert.equal(win.board.result.deltas.one,1);
});

test('Last Orders doubles positive changes and holds the scoreboard for payoff',()=>{
  const room=fixture({final:true});
  room.players[0].sparks+=1;
  assert.equal(verdict(room),2900);
  assert.equal(room.board.result.deltas.one,2);
});

test('relaxed mode retains generous timings without forcing long empty results',()=>{
  assert.equal(verdict(fixture({relaxed:true})),2600);
  const small=fixture({relaxed:true});
  small.players[0].sparks+=1;
  assert.equal(verdict(small),3400);
  const big=fixture({relaxed:true});
  big.players[0].sparks+=3;
  assert.equal(verdict(big),4200);
});

test('unfinished TV presentation is fully honoured before verdict timer',()=>{
  assert.equal(verdict(fixture({presentation:1800})),3100);
});
