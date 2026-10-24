// NOGGIN v3 round-loop simulation (model-based).
// Human accuracy and response times are estimates; mini-game rounds are allowed to
// run to their full server deadline. Minutes are SERVER time only: real rooms chat,
// laugh and argue, so expect an evening to run roughly 1.5x the simulated figure.
const crypto=require('node:crypto');
let seed=76231;
function rand(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
crypto.randomInt=rand;
const board=require('../server/board');
const phase3=require('../server/games/phase3');
const phase4=require('../server/games/phase4');
const phase5=require('../server/games/phase5');
const TAP=4000; // a person reading their phone and tapping a choice
function run(n,rounds,style){
 const room={phase:'lobby',hostSocketId:'tv',settings:{rounds,timerSpeed:'normal',rules:'showtime',roundStyle:style},players:Array.from({length:n},(_,i)=>({id:String(i),name:'P'+i,seat:i+1,sparks:0,position:0,ready:true,socketId:'phone'+i,offlineSince:null}))};
 board.start(room,1000);const started=1000;let now=started,steps=0;const scores=[];const kinds={};const spaces={};const selectedGames={};const visitedGames=new WeakSet();
 const rolls={};let showdowns=0,roundGames=0,laps=0;const visitedShowdowns=new WeakSet();
 let seenRevision=-1;
 while(room.phase==='board'&&steps++<20000){
 const b=room.board;
 if(b.step==='round_roll'){
  now+=TAP; // everyone taps at once
  for(const p of room.players){
   if(b.round.rolls[p.id])continue;
   if(p.cues>0&&rand(100)<35)board.choose(room,p.id,{action:'director'},now,rand);
   rolls[p.id]=(rolls[p.id]||0)+1;board.roll(room,p.id,now,rand);
  }
 }else if(b.step==='round_moving'){
  now=b.nextAt;board.tick(room,now,rand);
  if(b.lastMove&&b.lastMove.revision!==seenRevision&&b.step==='round_moving'){seenRevision=b.lastMove.revision;const type=board.SPACES[b.lastMove.to];kinds[type]=(kinds[type]||0)+1;spaces[b.lastMove.to]=(spaces[b.lastMove.to]||0)+1;if(b.lastMove.path.includes(0))laps++;now+=150*b.lastMove.path.length;}
 }else if(b.step==='await_roll'){
  const active=room.players.find(p=>p.id===b.activeId);
  now+=TAP;rolls[active.id]=(rolls[active.id]||0)+1;
  if(active.cues>0&&rand(100)<35)board.choose(room,b.activeId,{action:'director'},now,rand);
  const before=active.position;
  board.roll(room,b.activeId,now,rand);
  if(b.step==='choose_route'){
    now+=TAP;
    const value={applause:6,start:6,showdown:5,wildcard:4,pickpocket:4,speed:3,brain:3,create:3,together:3,swap:2,lift:1,drain:-6};
    const scored=b.routeOptions.map((o,index)=>({index,score:value[o.type]-o.cost*2})).sort((a,z)=>z.score-a.score||a.index-z.index);
    board.choose(room,b.activeId,{option:scored[0].index},now,rand);
  }
  if(b.step==='choose_die'){now+=TAP;board.pickDie(room,b.activeId,b.rolls[0]>b.rolls[1]?0:1,now);}
  const type=board.SPACES[b.landing];kinds[type]=(kinds[type]||0)+1;spaces[b.landing]=(spaces[b.landing]||0)+1;
  if(b.lastMove&&b.lastMove.path.includes(0))laps++;
  now+=1300+150*(b.lastMove?.path.length||0); // dice theatre + token hops on the TV
 }else if(b.step==='minigame'){
  const m=b.minigame;
  if(!visitedGames.has(m)){visitedGames.add(m);selectedGames[m.id]=(selectedGames[m.id]||0)+1;roundGames++;}
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
  if(!visitedShowdowns.has(m)){visitedShowdowns.add(m);if(m.kind!=='tiebreak')showdowns++;}
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
  now+=TAP;const target=room.players.filter(p=>p.id!==b.activeId).sort((a,z)=>z.sparks-a.sparks)[0];board.choose(room,b.activeId,{targetId:target.id},now,rand);
 }else if(b.step==='choose_category'){now+=TAP;board.choose(room,b.activeId,{category:board.CATEGORIES[rand(4)]},now,rand);}
 else if(b.step==='challenge'){
  const challenge=b.challenge;now+=2500;
  for(const id of challenge.participants){
   if(b.step!=='challenge'||b.challenge!==challenge)break;
   board.answer(room,id,rand(100)<55?challenge.correct:(challenge.correct+1)%challenge.choices.length,now);
  }
 }else if(b.step==='result'){
  if(b.stage==='round-game')scores.push(room.players.map(p=>p.sparks));now=b.nextAt;board.nextTurn(room,now,rand);
 }
 }
 const winner=room.board.winnerIds[0];const mid=scores[Math.floor((scores.length-1)/2)]||room.players.map(p=>p.sparks);const max=Math.max(...mid),min=Math.min(...mid);
 const index=room.players.findIndex(p=>p.id===winner);const final=room.players.map(p=>p.sparks).sort((a,z)=>z-a);
 return {rounds:room.board.round,minutes:(now-started)/60000,rollsPerPlayer:Object.values(rolls).reduce((a,x)=>a+x,0)/n,winnerAtHalfLeader:mid[index]===max,winnerAtHalfLast:mid[index]===min,
  kinds,spaces,selectedGames,showdowns,roundGames,laps:laps/n,tiebreak:room.board.stage==='noggin-off',margin:final[0]-final[1],winningScore:final[0],finished:room.phase==='finished',steps};
}
const games=Number(process.argv[2]||1000);
if(!Number.isSafeInteger(games)||games<1||games>10000)throw Error('Usage: node tools/simulate.js [games 1..10000] [auto|6|8|10|12] [--sequential]');
const style=process.argv.includes('--sequential')?'sequential':'everyone';
const roundsArgRaw=process.argv.slice(3).find(a=>!a.startsWith('--'));
const roundsArg=roundsArgRaw&&roundsArgRaw!=='auto'?Number(roundsArgRaw):'auto';
if(!board.ROUND_OPTIONS.includes(roundsArg))throw Error('Rounds must be one of '+board.ROUND_OPTIONS.join(', '));
const avg=(xs)=>+(xs.reduce((a,x)=>a+x,0)/xs.length).toFixed(1);
for(const count of [2,4,6,8]){
 const runs=[];for(let i=0;i<games;i++)runs.push(run(count,roundsArg,style));
 const kinds={},spaces={},miniGames={};
 for(const r of runs){for(const [k,v] of Object.entries(r.kinds))kinds[k]=(kinds[k]||0)+v;for(const [k,v] of Object.entries(r.spaces))spaces[k]=(spaces[k]||0)+v;for(const [k,v] of Object.entries(r.selectedGames))miniGames[k]=(miniGames[k]||0)+v;}
 const landings=Object.values(spaces).reduce((a,x)=>a+x,0);
 const perSpace=Array.from({length:board.SPACES.length},(_,i)=>(spaces[i]||0)/landings*100);
 const minutes=runs.map(r=>r.minutes).sort((a,z)=>a-z);
 console.log(JSON.stringify({roundStyle:style,players:count,rounds:roundsArg==='auto'?board.autoRounds(count,style):roundsArg,games,finished:runs.filter(r=>r.finished).length,
  rollsPerPlayer:avg(runs.map(r=>r.rollsPerPlayer)),lapsPerPlayer:avg(runs.map(r=>r.laps)),
  minutesMedian:+minutes[Math.floor(games/2)].toFixed(1),minutesP90:+minutes[Math.floor(games*0.9)].toFixed(1),
  roundGamesPerGame:avg(runs.map(r=>r.roundGames)),showdownsPerGame:avg(runs.map(r=>r.showdowns)),
  tiebreakPct:+(runs.filter(r=>r.tiebreak).length/games*100).toFixed(1),winningScore:avg(runs.map(r=>r.winningScore)),winningMargin:avg(runs.map(r=>r.margin)),
  leaderAtHalfWinsPct:+(runs.filter(r=>r.winnerAtHalfLeader).length/games*100).toFixed(1),lastAtHalfWinsPct:+(runs.filter(r=>r.winnerAtHalfLast).length/games*100).toFixed(1),
  spaceShareMinPct:+Math.min(...perSpace).toFixed(2),spaceShareMaxPct:+Math.max(...perSpace).toFixed(2),
  landings:kinds,miniGames}));
}
