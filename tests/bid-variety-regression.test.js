'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const rows=require('../data/bid-categories.json');
const normalise=s=>s.toLocaleLowerCase('en-GB').replace(/[^a-z0-9]/g,'');
test('Bid to Win keeps 60+ unique playable categories',()=>{
 // v3.5.0 Q7: trivial and vague categories were removed on purpose (quality over count).
 assert.ok(rows.length>=60);
 assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
 assert.equal(new Set(rows.map(x=>x.prompt.toLocaleLowerCase('en-GB'))).size,rows.length);
 for(const x of rows){assert.ok(x.answers.length>=4,x.id);assert.equal(new Set(x.answers.map(normalise)).size,x.answers.length,x.id);}
});
test('Bid to Win avoids substantially overlapping answer lists',()=>{
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=new Set(rows[i].answers.map(normalise)),b=new Set(rows[j].answers.map(normalise));
  const common=[...a].filter(v=>b.has(v)).length;
  assert.ok(common/Math.min(a.size,b.size)<0.75,`${rows[i].id} overlaps ${rows[j].id}`);
 }
});
