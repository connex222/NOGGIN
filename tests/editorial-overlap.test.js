const test = require('node:test');
const assert = require('node:assert/strict');
const {findOverlaps} = require('../tools/editorial-overlap');
test('editorial overlap detector finds answer-equivalent categories despite punctuation and casing', () => {
  const out = findOverlaps([
    {id:'first',prompt:'A',answers:['High E', 'A', 'B', 'C']},
    {id:'second',prompt:'B',answers:['high-e', 'a', 'b', 'c']},
    {id:'third',prompt:'C',answers:['dog', 'cat', 'owl', 'fox']}
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].fraction, 1);
  assert.deepEqual([out[0].a,out[0].b],['first','second']);
});
test('detector does not mutate categories or conflate unrelated answer sets', () => {
 const input = [{id:'a',answers:['one','two','three','four']},{id:'b',answers:['five','six','seven','eight']}];
 const before = JSON.stringify(input);
 assert.deepEqual(findOverlaps(input),[]);
 assert.equal(JSON.stringify(input),before);
});
