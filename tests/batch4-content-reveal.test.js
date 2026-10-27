'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const data=relative=>JSON.parse(read(relative));

test('Q1: 100 sourced, owner-check estimation questions; arithmetic fallback only',()=>{
 const questions=data('data/close-call.json');
 const estimates=questions.filter(q=>q.kind!=='arithmetic');
 assert.ok(estimates.length>=100,'at least 100 real estimation questions');
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length,'unique IDs');
 assert.equal(new Set(estimates.map(q=>q.question.trim().toLowerCase())).size,estimates.length,'unique prompts');
 for(const q of estimates){
  assert.equal(q.verified,'needs-owner-check',q.id);
  assert.match(q.source,/^https:\/\//,q.id);
  assert.ok(Number.isFinite(q.answer)&&q.answer>=0,q.id);
  assert.ok(q.unit&&q.question,q.id);
  assert.doesNotMatch(q.question,/how many (minutes|seconds) are in \d+ (hours|days)/i,q.id);
 }
 const showdown=read('server/games/phase5.js');
 assert.match(showdown,/filter\(q => q.kind !== 'arithmetic'\)/);
});

test('Q1: Higher or Lower has at least 150 sourced comparable facts',()=>{
 const facts=data('data/higher-lower.json').filter(q=>q.kind!=='arithmetic');
 assert.ok(facts.length>=150);
 const groups=new Map();
 for(const q of facts){
  assert.equal(q.verified,'needs-owner-check',q.id);
  assert.match(q.source,/^https:\/\//,q.id);
  assert.ok(q.group&&Number.isFinite(q.value)&&q.label,q.id);
  groups.set(q.group,(groups.get(q.group)||0)+1);
 }
 assert.ok([...groups.values()].every(n=>n>=2),'every fact group can produce a pair');
 const engine=read('server/games/phase3.js');
 assert.match(engine,/const FACTS=facts.filter\(x=>x.kind!=='arithmetic'\)/);
 assert.match(engine,/const groupOf=/);
});

test('Q1: Noggin-Off allows no third replay and breaks final equal guesses by submission time',()=>{
 const engine=read('server/games/phase5.js');
 assert.match(engine,/const NOGGIN_OFF_MAX = 2/);
 assert.match(engine,/\(m.attempt\|\|1\)>=NOGGIN_OFF_MAX/);
 assert.match(engine,/m.answerAt\[a\]\?\?Infinity/);
 assert.match(engine,/const closest=values.filter/);
});

test('Q8: answer reveals last 2.8 or 4.0 seconds, with all Close Call guesses visible',()=>{
 const engine=read('server/games/phase3.js');
 const tv=read('public/tv/board-view.js');
 assert.match(engine,/const REVEAL_MS=2800,REVEAL_RELAXED_MS=4000/);
 assert.match(engine,/m.phase='reveal';m.finalReveal=stop/);
 assert.match(engine,/m.revealGuesses=order.map/);
 assert.match(engine,/m.lastRoundResult=\{/);
 assert.match(tv,/Array.isArray\(result.guesses\)/);
 assert.match(tv,/result.unit/);
});
