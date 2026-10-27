'use strict';
// Real-server audio integration: checks the 77 playable local MP3 endpoints,
// manifests, and the studio-voice precedence that prevents legacy takes playing.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const {spawn} = require('node:child_process');
const root = path.join(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
function port() {
  return new Promise((resolve,reject)=>{
    const listener=net.createServer();
    listener.once('error',reject);
    listener.listen(0,'127.0.0.1',()=>{
      const p=listener.address().port;
      listener.close(()=>resolve(p));
    });
  });
}
function get(base,url) {
  return new Promise((resolve,reject)=>{
    const req=http.get(base+url,{timeout:5000},res=>{
      const parts=[];
      res.on('data',part=>parts.push(part));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts)}));
      res.on('error',reject);
    });
    req.on('error',reject);
    req.on('timeout',()=>req.destroy(new Error('audio endpoint timeout: '+url)));
  });
}
async function waitForServer(base,child) {
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw Error('NOGGIN exited before health check');
    try { const r=await get(base,'/health'); if(r.status===200)return; }catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('NOGGIN server did not start');
}
test('E2E AUDIO: real NOGGIN HTTP server delivers all 77 local Creative Claw recordings', {timeout:60000}, async t=>{
  const data=read('public/shared/creativeclaw-audio.json');
  const narration=read('public/tv/tutorial-narration.json');
  const expected=[
    ...Object.values(data.sfx),
    ...Object.values(data.voice),
    ...Object.values(data.music),
    ...narration.slides.map(s=>s.url),
  ];
  assert.equal(Object.keys(data.sfx).length,19,'studio effects');
  assert.equal(Object.keys(data.voice).length,36,'studio host cues');
  assert.equal(Object.keys(data.music).length,3,'studio music');
  assert.equal(narration.slides.length,19,'studio tutorial');
  assert.equal(expected.length,77);
  assert.equal(new Set(expected).size,77,'no duplicate audio paths');
  assert.ok(expected.every(url=>url.startsWith('/')&&!url.includes('://')),'local asset paths only');
  const voice=require('../server/voice').scan().takes;
  for(const id of Object.keys(data.voice).map(name=>name.slice(0,-4))) {
    assert.ok(voice[id]?.includes(id+'.mp3'),'server indexes studio voice '+id);
  }
  const source=fs.readFileSync(path.join(root,'public/tv/sound.js'),'utf8');
  assert.match(source,/takes\.includes\(premium\)\?premium/,'studio voice is preferred');
  const tutorialSource=fs.readFileSync(path.join(root,'public/tv/tutorial.js'),'utf8');
  for(const s of narration.slides)assert.ok(tutorialSource.includes(s.url),'tutorial points to '+s.url);
  const chosenPort=await port();
  const child=spawn(process.execPath,['server/index.js'],{
    cwd:root,
    env:{...process.env,PORT:String(chosenPort),NOGGIN_AUTO_PORT:'0',NOGGIN_OPEN_BROWSER:'0',NOGGIN_STATE_FILE:''},
    stdio:'ignore'
  });
  t.after(()=>{if(child.exitCode===null)child.kill('SIGTERM');});
  const base='http://127.0.0.1:'+chosenPort;
  await waitForServer(base,child);
  for(const url of expected){
    const r=await get(base,url);
    assert.equal(r.status,200,url+' HTTP response');
    assert.match(String(r.headers['content-type']),/audio\/mpeg|audio\/mp3|application\/octet-stream/,url+' content type');
    assert.ok(r.body.length>300,url+' contains audio');
    assert.ok(r.body.subarray(0,3).toString()==='ID3' ||
      (r.body[0]===255 && (r.body[1]&224)===224),url+' MP3 signature');
  }
  const manifest=await get(base,'/voice/voice-manifest.json');
  assert.equal(manifest.status,200);
  assert.equal(Object.keys(JSON.parse(manifest.body.toString()).lines).length,36);
  const tv=await get(base,'/tv/');
  assert.equal(tv.status,200);
  assert.match(tv.body.toString(),/\/tv\/tutorial\.js/);
});