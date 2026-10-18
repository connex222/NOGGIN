'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/tv/index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../public/tv/showcase.css'),'utf8');
test('v2 lobby has three contained panels, separate roster and launch',()=>{
 assert.match(html,/class="phone-main"/);assert.match(html,/id="lobbyRosterPanel"/);assert.match(html,/id="lobbyLaunch"/);
 assert.ok(html.indexOf('id="lobbyGrid"') < html.indexOf('id="lobbyControls"'));
 assert.ok(html.indexOf('id="lobbyControls"') < html.indexOf('id="lobbyRosterPanel"'));
 assert.ok(html.indexOf('id="lobbyRosterPanel"') < html.indexOf('id="lobbyLaunch"'));
 assert.match(css,/grid-template-columns:1\.04fr 1fr 1fr/);
 for(const id of ['roster','stageReady','qrImage','roomCode','joinUrl','target','timerSpeed','soundVolume','musicVolume'])
   assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
});
