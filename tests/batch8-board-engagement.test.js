'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('G1: caller chooses two games and corner lander selects rival with timeouts',()=>{
 const board=read('server/board.js');
 assert.match(board,/function gameOptions\(room, category, rng\)/);
 assert.match(board,/function pickRoundGame\(room, now, rng, gameId\)/);
 assert.match(board,/b\.gameOptions\?\.includes\(gameId\)/);
 assert.match(board,/choose_opponent/);
 assert.match(board,/choose_game/);
 assert.match(board,/pickMs\(room\)/);
});
test('G2: Classic rewards correct spectator picks only outside top two; Buzzer first to three',()=>{
 const duel=read('server/games/phase5.js');
 assert.match(duel,/BUZZER_TARGET = 3, BUZZER_QUESTIONS = 5/);
 assert.match(duel,/room\.players\.filter\(p=>p\.sparks>spectator\.sparks\)\.length>=2/);
 assert.match(duel,/spectator\.sparks\+=1/);
 assert.match(duel,/m\.cheers\[id\]=targetId/);
});
test('G6: Mind Meld starts simultaneous groups and supports a group of three',()=>{
 const engine=read('server/games/phase4.js');
 assert.match(engine,/function formMeldGroups/);
 assert.match(engine,/function finishMeldRound/);
 assert.match(engine,/m\.groups\.forEach/);
 assert.match(engine,/function groupMatch/);
 const tv=read('public/tv/board-view.js');
 assert.match(tv,/group of three/);
});
test('G7/G8: Steal the Call replaces swap and TV presents the caller badge',()=>{
 const board=read('server/board.js');
 const tv=read('public/tv/board-view.js');
 assert.match(board,/Steal the Call/);
 assert.match(board,/later colour \(or Steal the Call\)/);
 assert.match(tv,/CALL badge/);
 const tiles=read('public/shared/board-data.json');
 assert.match(tiles,/Steal the Call/);
});
test('G11/G12/Q9: special-space explainers, Last Orders standings, and player gap remain visible',()=>{
 const board=read('server/board.js');
 const tv=read('public/tv/board-view.js');
 const phone=read('public/play/play.js');
 assert.match(board,/function standingsSting\(room, now\)/);
 assert.match(board,/room\.board\.standings =/);
 assert.match(board,/explainer = \{type, text:/);
 assert.match(tv,/standingsSting/);
 assert.match(tv,/b\.explainer/);
 assert.match(phone,/function gapText\(/);
});
