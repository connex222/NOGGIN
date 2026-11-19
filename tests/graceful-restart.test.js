'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','server','index.js'),'utf8');

test('shutdown handlers work without NOGGIN_STATE_FILE',()=>{
  const conditional=source.indexOf('if(stateFile){');
  assert.ok(conditional>=0);
  assert.match(source,/process\.on\('SIGTERM',\(\)=>shutdown\('SIGTERM'\)\)/);
  assert.match(source,/process\.on\('SIGINT',\(\)=>shutdown\('SIGINT'\)\)/);
  assert.ok(source.indexOf("process.on('SIGTERM'")>source.indexOf('function shutdown(signal)'));
});

test('shutdown notifies sockets and enforces ten-second deadline',()=>{
  assert.match(source,/if\(shuttingDown\) return/);
  assert.match(source,/io\.emit\('server:restarting'/);
  assert.match(source,/io\.close\(/);
  assert.match(source,/setTimeout\(\(\)=>process\.exit\(0\),10_000\)/);
});
