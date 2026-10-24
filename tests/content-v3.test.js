'use strict';
// v3.4 content: Buzzer Battle is a general-knowledge quiz, not a maths test.
const {test}=require('node:test'),assert=require('node:assert/strict');
const bank=require('../data/buzzer-questions.json');
const phase5=require('../server/games/phase5');
test('every Buzzer question has a topic; at least 200 are general knowledge',()=>{
 for(const q of bank)assert.ok(typeof q.topic==='string'&&q.topic,q.id);
 assert.ok(bank.filter(q=>q.topic!=='maths').length>=200);
});
test('new v3 questions: four distinct choices, valid key, flagged for editorial review until source-checked',()=>{
 const v3=bank.filter(q=>q.id.startsWith('v3-buz-'));assert.ok(v3.length>=150);
 for(const q of v3){assert.equal(q.choices.length,4,q.id);assert.equal(new Set(q.choices.map(c=>c.toLowerCase())).size,4,q.id);
  assert.ok(Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4,q.id);
  if(q.editorialStatus!=='source-checked'){assert.equal(q.review,true,q.id);assert.equal(q.editorialStatus,'review-pending',q.id);}}
 const counts=[0,0,0,0];for(const q of v3)counts[q.correct]++;
 for(const c of counts)assert.ok(c>=v3.length*0.15,'answer positions should be spread out');
});
test('a Buzzer Battle never asks a sum while general questions remain, and never repeats within a match',()=>{
 const players=[{id:'a',name:'A',seat:1,sparks:3,position:6},{id:'b',name:'B',seat:2,sparks:3,position:0}];
 const room={settings:{timerSpeed:'normal',familyFriendly:true},players,board:{activeId:'a',landing:6,step:'choose_opponent'}};
 let r=0;const rng=n=>(r++*7)%n;
 phase5.start(room,'corner',1000,'b',rng);const m=room.board.showdown;assert.equal(m.kind,'buzzer');
 let t=1000;for(let i=0;i<40&&room.board.showdown;i++){t=(room.board.showdown.deadline||t)+1;phase5.tick(room,t,()=>{room.board.showdown=null;});}
 assert.equal(m.used.length,7,'seven questions asked by timeout');
 assert.equal(new Set(m.used).size,7,'no repeats');
 for(const id of m.used)assert.notEqual(bank.find(q=>q.id===id).topic,'maths',id);
});
test('Fib Factory plays the v3 obscure-fact bank: short answers, a blank in every prompt, review flags until checked',()=>{
 const fib=require('../data/fib-facts.json').filter(f=>f.id.startsWith('v3-fib-'));
 assert.ok(fib.length>=90);
 for(const f of fib){assert.ok(f.question.includes('___'),f.id);assert.ok(f.answer.length<=14,`${f.id}: answers must be short`);
  if(f.editorialStatus!=='source-checked'){assert.equal(f.review,true);assert.equal(f.editorialStatus,'review-pending');}}
 assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname,'../server/games/phase4.js'),'utf8'),/fibsAll\.filter\(f=>f\.id\.startsWith\('v3-fib-'\)\)/);
});
test('Brain Drain asks general knowledge, not sums',()=>{
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../server/board.js'),'utf8');
 assert.match(src,/DRAIN_QUESTIONS = require\('\.\.\/data\/buzzer-questions\.json'\)\.filter\(q => q\.topic !== 'maths'\)/);
 assert.match(src,/kind === 'drain' \? DRAIN_QUESTIONS : QUESTIONS/);
});
test('Caption This shows a picture when public/art/captions/<scene id> exists',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const dir=path.join(__dirname,'..','public','art','captions');fs.mkdirSync(dir,{recursive:true});
 const scenes=require('../data/caption-scenes.json');const file=path.join(dir,`${scenes[0].id}.webp`);
 fs.writeFileSync(file,'x');
 try{
  const phase4=require('../server/games/phase4');
  const players=[1,2,3].map(i=>({id:'p'+i,name:'P'+i,seat:i,sparks:0,position:0,socketId:'s'+i}));
  const room={settings:{timerSpeed:'normal',familyFriendly:true},players,board:{activeId:'p1',seenGames:[]}};
  phase4.start(room,'create',1000,()=>0,'caption-this');
  const m=room.board.minigame;m.used=[];
  // advance through the intro to the writing stage
  phase4.tick(room,m.deadline+1,()=>{},()=>0);
  const shown=room.board.minigame.display;
  assert.equal(shown.scene,scenes[0].scene);assert.equal(shown.image,`/art/captions/${scenes[0].id}.webp`);
 }finally{fs.unlinkSync(file);}
});
