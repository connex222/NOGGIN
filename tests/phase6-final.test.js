const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = bank => JSON.parse(fs.readFileSync(path.join(__dirname,'../data',`${bank}.json`),'utf8'));
const targets = {'buzzer-questions':400,'fib-facts':250,'close-call':200,'majority-questions':200,'mind-categories':180,'caption-scenes':120,'sketch-words':500,'unscramble':350,'higher-lower':350,'noise-clues':250,'bid-categories':120};
test('Every Phase 6 content target met',()=>{for(const [bank,target] of Object.entries(targets)) assert.ok(read(bank).length>=target, `${bank} below ${target}`)});
test('All new numeric content independently recalculates',()=>{
 for(const bank of ['buzzer-questions','fib-facts','close-call','higher-lower']) {
  for(const e of read(bank).filter(x=>x.id.startsWith('p6final-') && x.calc)) {
   const {type,a,b}=e.calc;
   const value=({multiply:()=>a*b,difference:()=>a-b,sum:()=>a+b,minutes:()=>a*60+b,double:()=>2*a+b,perimeter:()=>2*(a+b),multiplication:()=>a*b,identity:()=>a,addition:()=>a+b,'double-plus':()=>2*a+b,area:()=>a*b,mm:()=>a*10,cm:()=>a*100,km:()=>a*1000,seconds:()=>a*60})[type]();
   const stored=bank==='buzzer-questions'?Number(e.choices[e.correct]):bank==='fib-facts'?Number(e.answer):bank==='higher-lower'?e.value:e.answer;
   assert.equal(stored,value,`${bank}:${e.id}`);
  }
 }
});
test('New game content obeys answer and interaction constraints',()=>{
 for(const e of read('unscramble').filter(x=>x.id.startsWith('p6final-'))) assert.match(e.word,/^[A-Z]{6,8}$/);
 for(const e of read('majority-questions').filter(x=>x.id.startsWith('p6final-'))) assert.equal(new Set(e.options.map(s=>s.toLowerCase())).size,4);
 for(const e of read('bid-categories').filter(x=>x.id.startsWith('p6final-'))) { assert.ok(e.answers.length>=8);assert.equal(new Set(e.answers.map(s=>s.toLowerCase())).size,e.answers.length);assert.equal(e.review,true);}
});
