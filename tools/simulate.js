'use strict';
// Phase 6 model-based simulation of real board/mini-game outcome logic.
// Human accuracy, response times and the 75-second average-turn duration are estimates.
// Replace crypto.randomInt for deterministic in-process question/dice selection;
// this is an offline model only, never a replacement for server randomness.
const crypto=require('node:crypto');
let seed=76231;
function rand(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
crypto.randomInt=rand;
const board=require('../server/board');
const phase3=require('../server/games/phase3');
const phase4=require('../server/games/phase4');
const phase5=require('../server/games/phase5');
function run(n){
 const room={phase:'lobby',hostSocketId:'tv',settings:{target:12,timerSpeed:'normal'},players:Array.from({length:n},(_,i)=>({id:String(i),name:'P'+i,seat:i+1,sparks:0,position:0,ready:true,socketId:'phone'+i,offlineSince:null}))};
 board.start(room);let now=1000,steps=0;const scores=[];const kinds={};const selectedGames={};const visitedGames=new WeakSet();
 while(room.phase==='board'&&steps++<1000){
 const b=room.board;
 if(b.step==='await_roll'){
  // Synthetic strategy model: in 35% of eligible turns, try a Director's Cut.
  // The strategy prefers high-reward board spaces, but conserves a Cue unless
  // a nudge scores clearly better than a free move. Human choices will differ.
  const active=room.players.find(p=>p.id===b.activeId);
  if(active.cues>0&&rand(100)<35)board.choose(room,b.activeId,{action:'director'},now,rand);
  board.roll(room,b.activeId,now,rand);
  if(b.step==='choose_route'){
    const value={start:7,showdown:6,wildcard:5,speed:4,brain:4,create:4,together:4,pickpocket:4,swap:2,lift:1,drain:-6};
    const scored=b.routeOptions.map((o,index)=>({index,score:value[o.type]-o.cost*2})).sort((a,z)=>z.score-a.score||a.index-z.index);
    board.choose(room,b.activeId,{option:scored[0].index},now,rand);
  }
  if(b.step==='choose_die')board.pickDie(room,b.activeId,b.rolls[0]>b.rolls[1]?0:1,now);
  kinds[board.SPACES[b.landing]]=(kinds[board.SPACES[b.landing]]||0)+1;
 }else if(b.step==='minigame'){
  const m=b.minigame;
  if(!visitedGames.has(m)){visitedGames.add(m);selectedGames[m.id]=(selectedGames[m.id]||0)+1;}
  if(phase4.SPECS[m.id]){
   if(m.phase==='intro'){now=m.introUntil+1;board.tick(room,now);continue;}
   const input=(id,value)=>{if(room.board.minigame===m)try{board.minigameInput(room,id,value,m.roundKey,now+rand(30));}catch{}};
   const other=room.players.filter(p=>p.id!==m.host&&p.id!==m.secret.saboteur);
   switch(m.id){
    case 'sketch-sabotage':if(other.length&&rand(100)<60)input(other[0].id,m.secret.word);break;
    case 'noise-annoys':if(other.length&&rand(100)<65)input(other[0].id,m.secret.answer);break;
    case 'caption-this':
     if(m.phase==='play')for(const id of m.players)input(id,`Funny caption from ${id}`);
     else if(m.phase==='vote')for(const id of m.players){const available=m.optionOwners.map((o,i)=>o.owner!==id?i:-1).filter(x=>x>=0);if(available.length)input(id,available[rand(available.length)]);}
     break;
    case 'fib-factory':
     if(m.phase==='play')for(const id of m.players)input(id,`Pretend answer ${id}`);
     else if(m.phase==='vote')for(const id of m.players){const available=m.optionOwners.map((o,i)=>o.owner!==id?i:-1).filter(x=>x>=0);if(available.length)input(id,available[rand(available.length)]);}
     break;
    case 'mind-meld':
     if(m.phase==='partner')input(m.host,0);
     else if(m.phase==='play'){
      const same=rand(100)<30;input(m.host,same?'tea':'toast');input(m.partner,same?'tea':'teapot');
     }break;
    case 'majority-rules':for(const id of m.players)input(id,rand(4));break;
    case 'relay-sums':{
     const team=rand(2),task=m.secret.tasks[team][m.display.progress[team]];
     if(task)input(task.id,task.answer);break;
    }
    case 'bomb-squad':{
     if(rand(100)<15){const incorrect=m.display.wires.find(w=>w!==m.secret.wires[m.secret.cut]&&!m.display.cut.includes(w));if(incorrect)input(m.host,incorrect);}
     if(room.board.minigame===m){if(m.secret.cut<4)input(m.host,m.secret.wires[m.secret.cut]);else input(m.host,m.secret.digits.join(''));}
     break;
    }
   }
   if(room.board.minigame===m){now=Math.max(now,m.deadline+1);board.tick(room,now);}
   continue;
  }

  if(m.phase==='intro'){now=m.introUntil+1;board.tick(room,now);continue;}
  now=Math.max(now,m.openAt+1);
  const ids=m.players.filter(id=>!m.eliminated.includes(id));
  for(const id of ids){if(m.roundAnswers[id])continue;
    const skill=rand(100)<60;let value;
    if(m.id==='quick-draw')value=1;
    if(m.id==='count-flash')value=m.secret.count+(skill?rand(5):10+rand(20));
    if(m.id==='odd-spot')value=skill?m.secret.index:(m.secret.index+1)%36;
    if(m.id==='colour-clash'){const right=['RED','BLUE','GREEN','YELLOW'].indexOf(m.display.ink);value=skill?right:(right+1)%4;}
    if(m.id==='higher-lower')value=skill?m.secret.answer:1-m.secret.answer;
    if(m.id==='close-call')value=m.secret.answer+(skill?rand(10):100+rand(100));
    if(m.id==='unscramble')value=skill?m.secret.answer:'WRONG';
    if(m.id==='memory-lane') {const seq=m.display.reverse?[...m.secret.sequence].reverse():m.secret.sequence;for(const x of skill?seq:[(seq[0]+1)%6]){try{phase3.submit(room,id,x,m.roundKey,now);}catch{break;}}continue;}
    try{phase3.submit(room,id,value,m.roundKey,now+rand(150));}catch{}
  }
  now=m.deadline+1;board.tick(room,now);
 }else if(b.step==='showdown'){
  const m=b.showdown;
  if(m.phase==='intro'){now=m.deadline+1;phase5.tick(room,now,board.finishTurn);continue;}
  const input=(id,value)=>{if(room.board.showdown===m)try{phase5.submit(room,id,value,m.roundKey,now,board.finishTurn);}catch{}};
  if(m.kind==='buzzer'){
    if(m.phase==='buzz'){const id=m.participants[rand(2)];input(id,'buzz');}
    else if(m.phase==='answer'||m.phase==='pass'){
      const id=m.phase==='answer'?m.buzzId:m.passId;
      input(id,rand(100)<65?m.question.correct:(m.question.correct+1)%4);
    }
    now+=800;phase5.tick(room,now,board.finishTurn);
  }else if(m.kind==='tug'){
    const id=m.participants[rand(2)],sum=m.sums[id];
    input(id,{answer:rand(100)<65?sum.correct:sum.correct+1,qid:sum.n});now+=1800;phase5.tick(room,now,board.finishTurn);
  }else if(m.kind==='bid'){
    if(m.phase==='auction'){
      if(!m.bidderId)input(m.turnId,{action:'bid',count:Math.min(2,m.category.answers.length)});
      else input(m.turnId,{action:'challenge'});
    }else if(m.phase==='name'){
      const id=m.bidderId;
      if(rand(100)<62)input(id,m.category.answers[m.guesses.length]);
      else input(id,`wrong ${m.invalid+1}`);
    }
    now+=900;phase5.tick(room,now,board.finishTurn);
  }else if(m.kind==='nerve'){
    now+=1200;phase5.tick(room,now,board.finishTurn);
    if(room.board.showdown===m){for(const id of m.participants)if(!Object.hasOwn(m.banks,id)&&rand(100)<35)input(id,'bank');}
  }else if(m.kind==='tiebreak'){
    for(const id of m.participants)input(id,Math.max(0,m.questionData.answer+(rand(99)-49)));now+=500;phase5.tick(room,now,board.finishTurn);
  }
 }else if(b.step==='choose_target'||b.step==='choose_opponent'){
  const target=room.players.filter(p=>p.id!==b.activeId).sort((a,z)=>z.sparks-a.sparks)[0];board.choose(room,b.activeId,{targetId:target.id},now,rand);
 }else if(b.step==='choose_category')board.choose(room,b.activeId,{category:'brain'},now,rand);
 else if(b.step==='challenge'){
  const challenge=b.challenge;
  for(const id of challenge.participants){
   if(b.step!=='challenge'||b.challenge!==challenge)break;
   const chosen=rand(100)<55?challenge.correct:rand(3);
   board.answer(room,id,chosen,now+rand(1000));
  }
  if(b.step==='challenge'&&b.challenge===challenge)board.resolveChallenge(room,now+challenge.deadline-now+1);
 }else if(b.step==='result'){
  scores.push(room.players.map(p=>p.sparks));now+=5000;board.nextTurn(room,now);
 }
 }
 const winner=room.board.winnerIds[0];const mid=scores[Math.floor(scores.length/2)]||room.players.map(p=>p.sparks);const max=Math.max(...mid),min=Math.min(...mid);
 const index=room.players.findIndex(p=>p.id===winner);
 return {turns:room.board.turn,winnerAtHalfLeader:mid[index]===max,winnerAtHalfLast:mid[index]===min,kinds,selectedGames,finished:room.phase==='finished',steps};
}
const games=Number(process.argv[2]||1000);
if(!Number.isSafeInteger(games)||games<1||games>10000)throw Error('Usage: node tools/simulate.js [games 1..10000]');
for(const count of [2,4,6,8]){
 let sum=0,leader=0,last=0,finished=0;const spaces={};const miniGames={};const runs=[];
 for(let i=0;i<games;i++){const r=run(count);sum+=r.turns;leader+=Number(r.winnerAtHalfLeader);last+=Number(r.winnerAtHalfLast);finished+=Number(r.finished);runs.push(r.turns);for(const [k,v]of Object.entries(r.kinds))spaces[k]=(spaces[k]||0)+v;for(const [k,v]of Object.entries(r.selectedGames))miniGames[k]=(miniGames[k]||0)+v;}
 runs.sort((a,b)=>a-b);console.log(JSON.stringify({players:count,games,finished,averageTurns:+(sum/games).toFixed(1),estimatedMinutes:+(sum/games*75/60).toFixed(1),medianTurns:runs[Math.floor(games/2)],leaderAtHalfWinsPct:+(leader/games*100).toFixed(1),lastAtHalfWinsPct:+(last/games*100).toFixed(1),landings:spaces,miniGames}));
}
