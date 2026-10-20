'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const avatars=require('../public/shared/avatars.json');

// Regression: Windows separators used to produce public\avatars\thumbs\*.png.
test('Windows filename lookup places original PNGs in source-art, not the public thumbnails',()=>{
 const filename=path.posix.basename('/avatars/thumbs/av-01-judge-think.webp','.webp')+'.png';
 const win=path.win32.join('C:\\Games\\NOGGIN','source-art','avatars',filename);
 assert.equal(win,'C:\\Games\\NOGGIN\\source-art\\avatars\\av-01-judge-think.png');
 assert.ok(!win.includes('thumbs'));
});

test('All 36 runtime images are present without external source-art',()=>{
 for(const avatar of avatars)for(const state of ['think','win','lose']){
  const file=path.join(root,'public',avatar.images[state].replace(/^\//,''));
  assert.ok(fs.existsSync(file),file);
  const b=fs.readFileSync(file).subarray(0,12);
  assert.equal(b.toString('ascii',0,4),'RIFF');
  assert.equal(b.toString('ascii',8,12),'WEBP');
 }
});

test('Release audit completes with no missing archival PNG errors',()=>{
 const run=cp.spawnSync(process.execPath,['tools/release-audit.js'],{cwd:root,encoding:'utf8'});
 assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
 const report=JSON.parse(run.stdout);
 assert.equal(report.ok,true);
 assert.equal(report.errors.length,0);
});
