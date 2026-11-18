'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = pathName => fs.readFileSync(path.join(root,pathName),'utf8');

test('Batch 5 G3: Bid to Win gives the first bid to the rival, not the lander',()=>{
  const phase5 = read('server/games/phase5.js');
  assert.match(phase5,/participants=\[b\.activeId,opponentId\]/);
  assert.match(phase5,/m\.turnId=participants\[1\]/);
});

test('Batch 5 D10: only TV or non-duellist phones may adjudicate',()=>{
  const rooms=read('server/rooms.js');
  const phone=read('public/play/play.js');
  assert.match(rooms,/adjudicateBid\(code,socketId,accept\)/);
  assert.match(rooms,/socketId!==room\.hostSocketId/);
  assert.match(rooms,/!duel \|\| !duel\.participants\.includes\(judge\.id\)/);
  assert.match(phone,/if\(mine\)\{info\(/);
  assert.match(phone,/THE TV OR ANOTHER PLAYER WILL JUDGE/);
  const phase5=read('server/games/phase5.js');
  assert.match(phase5,/if\(!m\|\|m\.kind!=='bid'\|\|m\.phase!=='review'\|\|!m\.pendingReview\)/);
});

test('Batch 5 Q7: no arbitrary cap on reviewed unknown answers',()=>{
  const phase5=read('server/games/phase5.js');
  assert.match(phase5,/m\.reviewCount\+\+/);
  assert.doesNotMatch(phase5,/reviewCount\s*(?:>=|>|===)\s*3/);
  assert.match(phase5,/m\.pendingReview=\{/);
});

test('Batch 5 Q7: Bid to Win category list is soundly structured',()=>{
  const categories=JSON.parse(read('data/bid-categories.json'));
  assert.ok(categories.length>=30,'category variety');
  const ids=new Set();
  for(const category of categories) {
    assert.ok(category.id&&!ids.has(category.id),'unique category id '+category.id);
    ids.add(category.id);
    assert.ok(typeof category.prompt==='string'&&category.prompt.length>8,category.id);
    assert.ok(Array.isArray(category.answers)&&category.answers.length >= (category.kind === 'closed' ? 4 : 6),category.id);
    if (category.editorialStatus === 'source-checked') {
      assert.equal(category.review, false, category.id+' must not remain flagged after source verification');
      assert.match(category.sourceUrl, /^https:\/\//, category.id+' has source evidence');
    } else {
      assert.equal(category.editorialStatus, 'review-pending', category.id+' requires review');
      assert.equal(category.review, true, category.id+' must remain flagged until checked');
    }
    if(category.kind==='open')assert.ok(category.answers.length>=40,category.id+' must accept at least 40 entries');
    const answers=category.answers.map(x=>String(x).trim().toLowerCase());
    assert.equal(new Set(answers).size,answers.length,category.id+' has no duplicate canonical answers');
  }
  for(const removed of ['bid-21','bid-14','bid-11','p6b6-bid-010'])assert.ok(!ids.has(removed),removed+' removed');
  const fixed=categories.find(x=>x.id==='bid-16');
  if(fixed)assert.doesNotMatch(fixed.prompt,/six letters/i,'incorrect letter count removed');
});
