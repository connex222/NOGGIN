'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const roster = require('../public/shared/avatars.json');
const base = path.join(__dirname,'..','public');

test('12 unique character records with 36 bundled playable WebP avatar files',()=>{
  assert.equal(roster.length,12);
  assert.equal(new Set(roster.map(a=>a.id)).size,12);
  let count=0;
  for(const avatar of roster){
    for(const state of ['think','win','lose']){
      const display=path.join(base,avatar.images[state]);
      const webp=fs.readFileSync(display).subarray(0,12);
      assert.equal(webp.toString('ascii',0,4),'RIFF',display);
      assert.equal(webp.toString('ascii',8,12),'WEBP',display);
      assert.ok(fs.statSync(display).size>1000,display);
      count++;
    }
    const thumb=path.join(base,avatar.think);
    assert.ok(fs.statSync(thumb).size>1000, `thumbnail ${thumb}`);
  }
  assert.equal(count,36);
});
