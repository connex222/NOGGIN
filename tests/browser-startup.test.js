'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const file = name => fs.readFileSync(path.join(root,name),'utf8');

test('TV loads local error reporter before Socket.IO and page logic', () => {
  const html=file('public/tv/index.html');
  assert.match(html,/id="startupProblem"/);
  assert.ok(html.indexOf('/tv/load-guard.js') < html.indexOf('/socket.io/socket.io.js'));
  assert.ok(html.indexOf('/socket.io/socket.io.js') < html.indexOf('/tv/tv.js'));
});

test('A missing multiplayer script produces a visible diagnostic instead of silence', () => {
  const callbacks={};
  const errorBox={hidden:true,textContent:''};
  const sandbox={
    URL,
    window:{addEventListener:(name,fn)=>{callbacks[name]=fn}},
    document:{getElementById: id => id==='startupProblem' ? errorBox : {textContent:'ON AIR'}},
    setTimeout:()=>0,
  };
  vm.runInNewContext(file('public/tv/load-guard.js'),sandbox);
  callbacks.error({target:{tagName:'SCRIPT',src:'http://localhost:3001/socket.io/socket.io.js'}});
  assert.equal(errorBox.hidden,false);
  assert.match(errorBox.textContent,/socket\.io\/socket\.io\.js/);
  assert.match(errorBox.textContent,/\/check\//);
});

test('Diagnostic page checks all game resources without remote dependencies', () => {
  const html=file('public/check/index.html');
  const js=file('public/check/check.js');
  assert.match(html,/NOGGIN STARTUP CHECK/);
  assert.match(js,/\/health/);
  assert.match(js,/\/socket\.io\/socket\.io\.js/);
  assert.doesNotMatch(js,/https?:\/\//);
});

test('Windows launcher enables correct-port browser and produces a reopen helper', () => {
  assert.match(file('start-noggin.bat'),/NOGGIN_OPEN_BROWSER=1/);
  assert.match(file('start-noggin.bat'),/NOGGIN_PORT_FILE=/);
  assert.match(file('open-noggin.bat'),/state\\active-port\.txt/);
  assert.match(file('server/index.js'),/OPEN THIS TV ADDRESS:/);
});
