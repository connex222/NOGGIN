'use strict';
// v3.3 showmanship: how-to-play title cards and the host voice.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const phase3=require('../server/games/phase3'),phase4=require('../server/games/phase4');
const howto=JSON.parse(read('public/shared/howto.json'));
const voice=JSON.parse(read('public/shared/voice-lines.json'));
const GAMES=[...Object.keys(phase3.SPECS),...Object.keys(phase4.SPECS)];
const DUELS=['buzzer','tug','bid','nerve','tiebreak'];

test('every round game and Showdown has three short how-to-play steps',()=>{
 assert.equal(GAMES.length,16);
 for(const id of [...GAMES,...DUELS]){
  const steps=howto[id]?.steps;assert.ok(steps,`missing how-to for ${id}`);assert.equal(steps.length,3,id);
  for(const [icon,text] of steps){assert.ok(icon.trim(),id);assert.ok(text.length>=6&&text.length<=34,`${id}: "${text}" should be 6–34 characters`);}
 }
 assert.deepEqual(Object.keys(howto).sort(),[...GAMES,...DUELS].sort(),'no stray how-to entries');
});
test('intros last long enough to read the three steps (4.5 s normal, 6 s relaxed)',()=>{
 assert.match(read('server/games/phase3.js'),/relaxed'\?6000:4500/);
 assert.match(read('server/games/phase4.js'),/introUntil:now\+timer\(room,4\.5\)/);
});
test('TV and phones render the title card from the shared data',()=>{
 const tv=read('public/tv/board-view.js'),phone=read('public/play/play.js');
 assert.match(tv,/howToCard\(m\.id,m\.category/);assert.match(tv,/howToCard\(m\.kind,'showdown'/);
 assert.match(tv,/fetch\('\/shared\/howto\.json'\)/);assert.match(phone,/fetch\('\/shared\/howto\.json'\)/);
 assert.match(phone,/howToList\(m\.id\)/);assert.match(phone,/howToList\(m\.kind\)/);
});
test('voice script: unique ids, a line for every game and Showdown, and every id the TV asks for exists',()=>{
 const ids=voice.lines.map(l=>l.id);assert.equal(new Set(ids).size,ids.length,'duplicate voice ids');
 for(const l of voice.lines){assert.match(l.id,/^[a-z0-9-]+$/);assert.ok(l.say.length>=1&&l.when);}
 for(const g of GAMES)assert.ok(ids.includes(`game-${g}`),`no voice line for ${g}`);
 for(const d of ['buzzer','tug','bid','nerve'])assert.ok(ids.includes(`showdown-${d}`),d);
 const tv=read('public/tv/tv.js');
 for(const [,id] of tv.matchAll(/say\('([a-z0-9-]+)'/g))assert.ok(ids.includes(id),`tv.js says unknown line "${id}"`);
 for(const [,fb] of tv.matchAll(/say\([^)]*?,'([a-z0-9-]+)'\)/g))assert.ok(ids.includes(fb),`fallback "${fb}" missing`);
});
test('voice scan: picks up takes by exact name, ignores strangers, tolerates a missing folder',()=>{
 const {scan}=require('../server/voice');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'noggin-voice-'));
 for(const f of ['welcome.mp3','welcome-2.m4a','game-quick-draw.mp3','game-quick-draw-2.mp3','showdown-bid.wav','mystery.mp3','notes.txt'])fs.writeFileSync(path.join(dir,f),'x');
 const {takes,unknown}=scan(dir);
 assert.deepEqual(takes,{'game-quick-draw':['game-quick-draw-2.mp3','game-quick-draw.mp3'],'showdown-bid':['showdown-bid.wav'],welcome:['welcome-2.m4a','welcome.mp3']});
 assert.deepEqual(unknown,['mystery.mp3']);
 assert.deepEqual(scan(path.join(dir,'absent')),{takes:{},unknown:[]});
});
test('server serves a live voice manifest before static files',()=>{
 const src=read('server/index.js');
 assert.ok(src.indexOf("app.get('/voice/voice-manifest.json'")<src.indexOf('app.use(express.static('));
});
test('TV defers sounds and voice until the token lands, and says nothing it has not recorded',()=>{
 const tv=read('public/tv/tv.js'),sound=read('public/tv/sound.js');
 assert.match(tv,/if\(boardView\?\.presenting\(\)\)\{pendingFx=state;return;\}/);
 assert.match(tv,/boardView\.onPresented=/);
 assert.match(sound,/if\(!key\)return false;/);
});
