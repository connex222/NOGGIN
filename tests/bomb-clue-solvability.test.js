'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeBomb}=require('../server/games/phase4');
function seeded(seed){let state=seed>>>0;return n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n;};}
function solve(clues){
 const joined=clues.join(' ');
 const first=/FIRST wire is (RED|BLUE|GREEN|YELLOW)/.exec(joined)?.[1];
 const second=/(RED|BLUE|GREEN|YELLOW) comes immediately AFTER (RED|BLUE|GREEN|YELLOW)/.exec(joined);
 const third=/(RED|BLUE|GREEN|YELLOW) is immediately AFTER (RED|BLUE|GREEN|YELLOW)/.exec(joined);
 const last=/LAST wire is (RED|BLUE|GREEN|YELLOW)/.exec(joined)?.[1];
 const digit1=Number(/FIRST keypad digit is (\d)/.exec(joined)?.[1]);
 const sum=Number(/FIRST TWO digits add up to (\d+)/.exec(joined)?.[1]);
 const digit3=Number(/THIRD keypad digit is (\d)/.exec(joined)?.[1]);
 const digit4=Number(/FOURTH keypad digit is (\d)/.exec(joined)?.[1]);
 assert(first&&second&&third&&last,'All wire-order clues must be present');
 assert.equal(second[2],first);
 assert.equal(third[2],second[1]);
 return {wires:[first,second[1],third[1],last],digits:[digit1,sum-digit1,digit3,digit4]};
}
test('Bomb Squad clues collectively determine the exact solution for 2–8 players across 100 seeds',()=>{
 for(let players=2;players<=8;players++)for(let seed=1;seed<=100;seed++){
  const ids=Array.from({length:players},(_,i)=>`guest${i}`);
  const bomb=makeBomb(ids,seeded(seed));
  const clues=ids.flatMap(id=>bomb.privateById[id].clues);
  assert.equal(clues.length,players>4?players:4);
  assert.deepEqual(solve(clues),{wires:bomb.colours,digits:bomb.digits},`players=${players}, seed=${seed}`);
  assert.equal(new Set(bomb.colours).size,4);
  assert(bomb.digits.every(n=>Number.isInteger(n)&&n>=0&&n<=9));
 }
});
