'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('TV starts at the actual lobby without loading either legacy cinematic', () => {
  const html = source('public/tv/index.html');
  assert.match(html, /id="welcomeScreen"[^>]*hidden/);
  assert.doesNotMatch(html, /<script[^>]+cinematic-v4\.js/);
  assert.match(html, /id="lobbyHeadstart"/);
  assert.match(html, /id="lobbyControls"/);
});

test('HEADSTART takes exclusive ownership of TV host audio and restores it once', () => {
  const callbacks = {};
  class Clip {
    constructor(src) { this.src=src;this.paused=false;this.ended=false;this.cleared=false; }
    pause(){this.paused=true;}
    removeAttribute(){this.cleared=true;}
    load(){}
    play(){this.paused=false;return Promise.resolve();}
  }
  const window = {AudioContext:class{},NogginSound:null};
  vm.runInNewContext(source('public/tv/sound.js'),{
    window,Audio:Clip,fetch:async()=>({ok:false}),localStorage:{getItem:()=>null,setItem:()=>{}},
    setInterval:()=>1,clearInterval:()=>{},Symbol,Math,Number,Set
  });
  const sound = new window.NogginSound();
  sound.enabled=true;sound.muted=false;sound.voiceLines={winner:['winner.mp3']};
  sound.voiceAudio=new Clip('host.mp3');
  sound.desiredMusic='lobby';
  sound.suspendForTutorial();
  assert.equal(sound.tutorialActive,true);
  assert.equal(sound.voiceAudio,null);
  assert.equal(sound.say('winner'),false);
  sound.startMusic('board');
  assert.equal(sound.resumeMusicAfterTutorial,'board');
  sound.enabled=false; // simulated browser with audio not unlocked after tutorial
  sound.resumeAfterTutorial();
  assert.equal(sound.tutorialActive,false);
  assert.equal(sound.resumeMusicAfterTutorial,null);
  assert.equal(sound.desiredMusic,'board');
  sound.resumeAfterTutorial(); // idempotent, no duplicate restart
});

test('tutorial hands audio stage back on exit and reduces ordinary result effects', () => {
  const tutorial=source('public/tv/tutorial.js');
  const tv=source('public/tv/tv.js');
  assert.match(tutorial,/NogginTVAudio\?\.suspendForTutorial/);
  assert.match(tutorial,/NogginTVAudio\?\.resumeAfterTutorial/);
  assert.match(tv,/won&&gain>=3/);
  assert.match(tv,/b\.step==='finished'.*showConfetti\(\)/);
});
