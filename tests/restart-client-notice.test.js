'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('server notifies both TV and phone before closing sockets',()=>{
 const server=load('server/index.js');
 const tv=load('public/tv/tv.js');
 const phone=load('public/play/play.js');
 assert.match(server,/io\.emit\('server:restarting'/);
 assert.match(tv,/socket\.on\('server:restarting'/);
 assert.match(phone,/socket\.on\('server:restarting'/);
 assert.match(tv,/Server restarting, reconnecting/);
 assert.match(phone,/Server restarting, reconnecting/);
});
