'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const text=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Q3: all 350 Unscramble entries have specific clues and avoid known family-safety problems',()=>{
 const data=json('data/unscramble.json');
 assert.equal(data.length,350);
 for(const item of data){
  assert.ok(item.word&&item.category&&item.category.toLowerCase()!=='everyday words',item.id);
  assert.ok(!['FLASHER','INSECT'].includes(item.word.toUpperCase()),item.id);
 }
 assert.ok(data.some(x=>Array.isArray(x.accept)&&x.accept.length>0),'alternative anagrams supported');
 const engine=text('server/games/phase3.js');
 assert.match(engine,/accept:\[item\.word,\.\.\.\(item\.accept\|\|\[\]\)\]/);
});

test('Q4: all 250 Noise clues have declared aliases, Sketch has alternative answers',()=>{
 const noises=json('data/noise-clues.json'),words=json('data/sketch-words.json');
 assert.equal(noises.length,250);
 for(const n of noises)assert.ok(Array.isArray(n.aliases)&&n.aliases.length,n.id);
 assert.ok(words.length>=500&&words.some(w=>w.accept?.length));
 const code=text('server/games/phase4.js');
 assert.match(code,/match\.containsPhrase\(guess,alias\)/);
 assert.match(code,/match\.sameAsAny\(guess,targets\)/);
 assert.match(code,/feedback\(m,id,/);
});

test('Q5: Fib Factory compares digits and number words using common answer matcher',()=>{
 const game=text('server/games/phase4.js');
 const matcher=require('../server/answer-match');
 assert.match(game,/match\.same\(text,m\.secret/);
 assert.equal(matcher.same('five','5'),true);
 assert.equal(matcher.same('forty two','42'),true);
 assert.equal(matcher.same('one hundred','100'),true);
 assert.equal(matcher.same('five','6'),false);
});

test('Q6: Buzzer difficulty coverage, unique general questions and shuffled answer positions',()=>{
 const all=json('data/buzzer-questions.json'),general=all.filter(q=>q.topic!=='maths');
 assert.ok(general.length>=300);
 assert.equal(new Set(general.map(q=>q.question.trim().toLowerCase())).size,general.length);
 const totals={easy:0,medium:0,hard:0};
 for(const q of general){
  assert.ok(Object.hasOwn(totals,q.difficulty),q.id);
  assert.ok(Array.isArray(q.choices)&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<q.choices.length,q.id);
  totals[q.difficulty]++;
 }
 const n=general.length;
 assert.ok(Math.abs(totals.easy/n-.4)<.055);
 assert.ok(Math.abs(totals.medium/n-.4)<.055);
 assert.ok(Math.abs(totals.hard/n-.2)<.055);
 const duel=require('../server/games/phase5');
 assert.equal(duel.buzzerLevel(1,5),'easy');
 assert.equal(duel.buzzerLevel(3,5),'medium');
 assert.equal(duel.buzzerLevel(5,5),'hard');
 const original={choices:['A','B','C','D'],correct:2};
 const reversed=duel.shuffled(original,()=>0);
 assert.equal(reversed.choices[reversed.correct],'C');
});
