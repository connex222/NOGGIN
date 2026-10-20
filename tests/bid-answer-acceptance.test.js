'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {acceptedAnswer}=require('../server/bid-answers');
const bid=require('../data/bid-categories.json');
test('all Bid examples are accepted by server matcher',()=>{
 for(const category of bid)for(let i=0;i<category.answers.length;i++)
  assert.equal(acceptedAnswer(category,category.answers[i]),i,`${category.id}: ${category.answers[i]}`);
});
test('common UK synonyms and spelling alternatives are accepted',()=>{
 const c={answers:['Sun cream','Wellies','Full stop','Pitta','Courgette','Aeroplane']};
 for(const [given,index] of [['sunscreen',0],['Wellington boots',1],['period',2],['pita bread',3],['zucchini',4],['airplane',5]])
  assert.equal(acceptedAnswer(c,given),index,given);
});
test('invalid guesses and unrelated words are rejected',()=>{
 assert.equal(acceptedAnswer({answers:['Piano','Guitar']},'rhinoceros'),-1);
});
test('review flags remain when open-ended categories cannot yet be fairly judged',()=>{
 assert.equal(bid.filter(x=>x.review===true).length,89);
 assert.equal(bid.filter(x=>x.editorialStatus==='scope-checked').length,0);
});
