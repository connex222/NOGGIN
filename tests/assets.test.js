'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const roster = require('../public/shared/avatars.json');
const base = path.join(__dirname,'..','public');

test('12 unique character records with 36 original full-size RGBA avatar files',()=>{
  assert.equal(roster.length,12);
  assert.equal(new Set(roster.map(a=>a.id)).size,12);
  let count=0;
  for(const avatar of roster){
    for(const state of ['think','win','lose']){
      const display=path.join(base,avatar.images[state]);
      const webp=fs.readFileSync(display).subarray(0,12);
      assert.equal(webp.toString('ascii',0,4),'RIFF',display);
      assert.equal(webp.toString('ascii',8,12),'WEBP',display);
      const file=path.join(base,avatar.images[state].replace('/thumbs/','/').replace(/\.webp$/,'.png'));
      const header=fs.readFileSync(file).subarray(0,26);
      assert.equal(header.subarray(0,8).toString('hex'),'89504e470d0a1a0a',file);
      assert.equal(header.readUInt32BE(16),1024,`width of ${file}`);
      assert.equal(header.readUInt32BE(20),1024,`height of ${file}`);
      assert.equal(header[25],6,`RGBA PNG expected ${file}`);
      count++;
    }
    const thumb=path.join(base,avatar.think);
    assert.ok(fs.statSync(thumb).size>1000, `thumbnail ${thumb}`);
  }
  assert.equal(count,36);
});
