'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/play/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'public/play/play.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/play/studio.css'),'utf8');

test('phone v2 has consistent real-logo header, layout and correct room controls',()=>{
  assert.match(html,/\/play\/art\/noggin-logo\.webp/);
  assert.match(html,/\/play\/studio\.css/);
  for(const id of ['joinForm','avatarGrid','readyButton','swapAvatarGrid','gameAvatar',
    'gameHeadline','gameButtons','gameClockFill','gameCountdown','gameStateTag','gameSparks']){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
  const logo=fs.readFileSync(path.join(root,'public/play/art/noggin-logo.webp'));
  assert.equal(logo.toString('ascii',0,4),'RIFF');assert.equal(logo.toString('ascii',8,12),'WEBP');
});

test('phone v2 uses local stage styling and responsive functional inputs',()=>{
  assert.doesNotMatch(html,/<(?:script|link)[^>]+(?:src|href)=["']https?:/i);
  assert.match(css,/\.mini-grid-button/);
  assert.match(css,/\.sketch-canvas/);
  assert.match(css,/\.memory-pad/);
  assert.match(css,/\.mini-answer input/);
  assert.match(css,/focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/@media\(max-height:745px\)/);
});

test('all 16 mini-games and four Showdowns keep their original server actions',()=>{
  for(const id of ['quick-draw','count-flash','odd-spot','colour-clash','higher-lower','memory-lane',
    'close-call','unscramble','sketch-sabotage','noise-annoys','caption-this','fib-factory',
    'mind-meld','majority-rules','relay-sums','bomb-squad']) assert.ok(js.includes(`'${id}'`),id);
  for(const kind of ['buzzer','tug','bid','nerve']) assert.ok(js.includes(`'${kind}'`),kind);
  for(const event of ['game:input','game:draw','game:roll','game:answer','game:choose',
    'game:pick-die','game:cheer']) assert.ok(js.includes(`'${event}'`),event);
  assert.match(js,/Array\.from\(\{length:36\}/);
  assert.match(js,/setPhonePresentation\(b\)/);
  assert.match(js,/gameClockFill/);
});

test('release version is 3.x and phones keep saved room credentials',()=>{
  const pkg=require('../package.json');assert.match(pkg.version,/^3\./);
  assert.match(js,/noggin-player-session-v1/); // Existing saved player sessions still resume.
  assert.match(js,/room:resume/);
});
