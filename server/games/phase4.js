'use strict';
/** NOGGIN Phase 4: server-authoritative Create and Together games.
 * The public DTO never contains secret words, correct answers, saboteur IDs,
 * ballot ownership, bomb solutions, or another player's private clues.
 */
const crypto = require('node:crypto');
const {enforceFamilyText}=require('../content-filter');
const sketch = require('../../data/sketch-words.json');
const noises = require('../../data/noise-clues.json');
const scenes = require('../../data/caption-scenes.json');
const fibs = require('../../data/fib-facts.json');
const melds = require('../../data/mind-categories.json');
const majorities = require('../../data/majority-questions.json');
const SPECS = Object.freeze({
 'sketch-sabotage': {name:'Sketch & Sabotage',category:'create',rule:'The host sketches a secret word. A secret saboteur may add three misleading strokes. Everyone else guesses.'},
 'noise-annoys': {name:'Noise Annoys',category:'create',rule:'The host performs sound effects aloud in the room—no words or mime. First correct guess wins.'},
 'caption-this': {name:'Caption This',category:'create',rule:'Write a funny caption for the TV scene, then vote anonymously. You cannot vote for yourself.'},
 'fib-factory': {name:'Fib Factory',category:'create',rule:'Invent a convincing wrong answer, then try to find the truth amongst the bluffs.'},
 'mind-meld': {name:'Mind Meld',category:'together',rule:'The host picks a partner. Write the same word without talking, within three tries.'},
 'majority-rules': {name:'Majority Rules',category:'together',rule:'Vote secretly on three silly questions. Score when you join the largest group.'},
 'relay-sums': {name:'Relay Sums',category:'together',rule:'Solve your team’s maths in seat order. Each answer unlocks the next teammate’s sum.'},
 'bomb-squad': {name:'Bomb Squad',category:'together',rule:'Talk to share private clues. Cut four wires in order, then enter the four-digit code before time runs out.'}
});
const TWO_PLAYER_UNAVAILABLE=Object.freeze(['caption-this','majority-rules']);
const CATALOG=Object.entries(SPECS).map(([id,x])=>({id,...x}));
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function choose(pool,rng){return pool[rng(pool.length)];}
function normalize(text){return String(text).normalize('NFKC').toLocaleLowerCase('en-GB').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function isClueGuess(guess,answer){const a=normalize(answer),g=normalize(guess);return g===a||(g.length>=5&&a.includes(g))||(a.length>=7&&g.includes(a));}
function clean(value,max=85){
 if(typeof value!=='string'||value.trim().length<1||value.length>max||/[<>\u0000-\u001f\u007f]/u.test(value))fail('INPUT',`Please enter 1–${max} characters without markup.`);
 return value.normalize('NFKC').trim().replace(/\s+/g,' ');
}
function timer(room,s){return Math.round(s*1000*(room.settings.timerSpeed==='relaxed'?1.45:1));}
function setPhase(room,phase,now,seconds){const m=room.board.minigame;m.phase=phase;m.deadline=now+timer(room,seconds);room.board.deadline=m.deadline;}
function pickFresh(m,pool,rng){const free=pool.filter(x=>!m.usedIds.includes(x.id));const item=choose(free.length?free:pool,rng);m.usedIds.push(item.id);return item;}
function chooseGame(b,category,rng=crypto.randomInt,playerCount=4){
 // Two-person Caption This: both must vote for the other. Two-person Majority
 // Rules: both always receive the same score. Neither is a meaningful contest.
 const unavailable=playerCount===2?new Set(TWO_PLAYER_UNAVAILABLE):new Set();
 const choices=CATALOG.filter(s=>s.category===category&&!unavailable.has(s.id)).map(s=>s.id);
 const fresh=choices.filter(id=>!b.seenGames?.includes(id));
 const pool=(fresh.length?fresh:choices).filter(id=>id!==b.lastGame);
 const id=choose(pool.length?pool:choices,rng);b.lastGame=id;b.seenGames=[...(b.seenGames||[]),id].slice(-16);return id;
}
function makeSums(players,rng){
 const teams=[players.filter((_,i)=>i%2===0),players.filter((_,i)=>i%2===1)];
 const tasks=teams.map(group=>Array.from({length:Math.max(4,group.length*2)},(_,i)=>{
  const a=3+rng(25),c=2+rng(18),isSubtract=rng(3)===0;
  return {id:group[i%group.length],prompt:isSubtract?`${a+c} − ${a} = ?`:`${a} + ${c} = ?`,answer:isSubtract?c:a+c};
 }));
 return {teams,tasks};
}
function makeBomb(players,rng){
 const colours=['RED','BLUE','GREEN','YELLOW'];for(let i=3;i>0;i--){const j=rng(i+1);[colours[i],colours[j]]=[colours[j],colours[i]];}
 const digits=Array.from({length:4},()=>rng(10));
 // Each scrap provides a fragment; no individual scrap reveals the full
 // solution. The whole team must order wires and solve one simple arithmetic
 // relationship. For 5–8 players scraps are duplicated so nobody is idle.
 const clues=[
  `Clue A: The FIRST wire is ${colours[0]}. The FOURTH keypad digit is ${digits[3]}.`,
  `Clue B: ${colours[2]} is immediately AFTER ${colours[1]}. The FIRST TWO digits add up to ${digits[0]+digits[1]}.`,
  `Clue C: The LAST wire is ${colours[3]}. The THIRD keypad digit is ${digits[2]}.`,
  `Clue D: ${colours[1]} comes immediately AFTER ${colours[0]}. The FIRST keypad digit is ${digits[0]}.`
 ];
 const privateById={};players.forEach((id,i)=>privateById[id]={
  clues:players.length>4?[clues[i%4]]:clues.filter((_,j)=>j%players.length===i)
 });
 return {colours,digits,privateById};
}
function start(room,category,now,rng=crypto.randomInt,forcedId=null){
 const id=forcedId||chooseGame(room.board,category,rng,room.players.length),spec=SPECS[id];if(!spec||spec.category!==category)fail('GAME','Invalid game for category.');
 const b=room.board,participants=room.players.map(p=>p.id),host=b.activeId;
 const m={id,category,title:spec.name,rule:spec.rule,round:1,roundKey:1,totalRounds:id==='majority-rules'||id==='mind-meld'?(room.settings.rules==='showtime'?5:3):1,
  phase:'intro',resumePhase:id==='mind-meld'?'partner':'play',introUntil:now+timer(room,3.5),deadline:now+timer(room,3.5),host,players:participants,
  secret:{},privateById:{},display:{},answers:{},scores:Object.fromEntries(participants.map(id=>[id,0])),
  usedIds:[],strokes:[],strokeCounts:{},lastResult:null,stageStarted:now+timer(room,3.5),seconds:0,choices:[],voters:{},optionOwners:[],voteStageAnswers:{}, roundWords:[]};
 b.minigame=m;b.challenge=null;b.result=null;b.step='minigame';b.deadline=m.deadline;
 switch(id){
  case 'sketch-sabotage':{
   const word=pickFresh(m,sketch,rng);const opponents=participants.filter(x=>x!==host);
   const saboteur=opponents.length>=2?choose(opponents,rng):null;
   m.secret={word:word.word,saboteur};m.privateById[host]={role:'artist',word:word.word};
   if(saboteur)m.privateById[saboteur]={role:'saboteur',strokesLeft:3};
   m.display={category:word.category,strokes:[],maxSaboteurStrokes:3};m.seconds=60;m.question=`DRAW: ${word.category} · Watch the live sketch.`;break;
  }
  case 'noise-annoys':{
   const c=pickFresh(m,noises,rng);m.secret={answer:c.clue,aliases:c.aliases||[]};m.privateById[host]={role:'performer',clue:c.clue};
   m.question='Listen to the performer in the room. Type what sound you think it is.';m.seconds=45;break;
  }
  case 'caption-this':{
   const item=pickFresh(m,scenes,rng);m.question=item.scene;m.display={avatars:item.avatars,scene:item.scene};m.seconds=35;break;
  }
  case 'fib-factory':{
   const item=pickFresh(m,fibs,rng);m.question=item.question;m.secret={answer:item.answer};m.seconds=28;break;
  }
  case 'mind-meld':{
   const item=pickFresh(m,melds,rng);m.question=`Category: ${item.category}`;m.display={category:item.category,attempt:1};m.seconds=13;break;
  }
  case 'majority-rules':{m.seconds=15;prepareMajority(room,rng);break;}
  case 'relay-sums':{
   const {teams,tasks}=makeSums(participants,rng);m.secret={tasks};m.display={teams,progress:[0,0],totals:tasks.map(x=>x.length)};m.seconds=65;m.question='Two teams race to finish their maths relay!';break;
  }
  case 'bomb-squad':{
   const bomb=makeBomb(participants,rng);m.secret={wires:bomb.colours,digits:bomb.digits,cut:0};m.privateById=bomb.privateById;
   m.display={wires:['RED','BLUE','GREEN','YELLOW'],cut:[],keypadReady:false};m.seconds=60;m.question='Share your clue scraps aloud. The host cuts the wires then enters the code.';break;
  }
 }
 b.event={type:'minigame',category,text:`${spec.name}: ${spec.rule}`};return m;
}
function prepareMajority(room,rng){
 const m=room.board.minigame,item=pickFresh(m,majorities,rng);m.question=item.question;m.display={options:item.options};m.answers={};m.roundKey++;
}
function finish(room,now,finishTurn,winners,description,{team=false,bomb=false,sabotage=false}={}){
 const b=room.board,m=b.minigame;if(!m)return;
 const winnersSet=new Set(winners);const host=room.players.find(p=>p.id===m.host);
 if(bomb){if(winners.length){for(const p of room.players)p.sparks+=p.id===host.id?2:1;}else host.sparks=Math.max(0,host.sparks-1);}
 else if(sabotage){
  for(const p of room.players)if(winnersSet.has(p.id))p.sparks+=p.id===m.secret.saboteur?2:(p.id===host.id?2:1);
  if(!winners.length)host.sparks=Math.max(0,host.sparks-1);
 }else if(team){for(const p of room.players)if(winnersSet.has(p.id))p.sparks+=1;}
 else{
  for(const p of room.players)if(winnersSet.has(p.id))p.sparks+=p.id===host.id?2:1;
  const values=Object.values(m.scores),lo=Math.min(...values),hi=Math.max(...values);
  if(!winnersSet.has(host.id)&&hi>lo&&m.scores[host.id]===lo)host.sparks=Math.max(0,host.sparks-1);
 }
 b.minigame=null;finishTurn(room,now,description,winners);
}
function finishNoise(room,now,finishTurn){const m=room.board.minigame;if(!m)return;const win=m.secret.guesser?[m.host,m.secret.guesser]:[];finish(room,now,finishTurn,win,win.length?`${room.players.find(p=>p.id===m.secret.guesser).name} guessed the sound! The performer also wins.`:'Nobody guessed the sound before time expired.');}
function finishSketch(room,now,finishTurn){const m=room.board.minigame;if(!m)return;const sab=m.secret.saboteur,win=m.secret.guesser?[m.host,m.secret.guesser]:sab?[sab]:[];finish(room,now,finishTurn,win,m.secret.guesser?'The artist and first correct guesser win!':sab?'The secret Saboteur fooled the whole room: +2 Sparks!':'The sketch beat the guessers.',{sabotage:true});}
function makeVoting(room,now,rng=crypto.randomInt){
 const m=room.board.minigame;
 if(m.id==='caption-this'){
  const originals=Object.entries(m.answers).filter(([,v])=>v.text).map(([id,v])=>({owner:id,text:v.text}));
  if(!originals.length)return false;
  for(let i=originals.length-1;i>0;i--){const j=rng(i+1);[originals[i],originals[j]]=[originals[j],originals[i]];}
  m.optionOwners=originals;m.choices=originals.map(o=>o.text);
 } else {
  const truth={owner:null,text:m.secret.answer};const originals=[truth,...Object.entries(m.answers).filter(([,v])=>v.text&&normalize(v.text)!==normalize(truth.text)).map(([id,v])=>({owner:id,text:v.text}))];
  for(let i=originals.length-1;i>0;i--){const j=rng(i+1);[originals[i],originals[j]]=[originals[j],originals[i]];}
  m.optionOwners=originals;m.choices=originals.map(o=>o.text);
 }
 m.display={options:m.choices};m.voters={};m.roundKey++;
 setPhase(room,'vote',now,23);return true;
}
function finishVoting(room,now,finishTurn){
 const m=room.board.minigame;if(!m)return;
 if(m.id==='caption-this'){
  for(const choice of Object.values(m.voters)){
   const owner=m.optionOwners[choice]?.owner;if(owner)m.scores[owner]++;
  }
  const max=Math.max(...Object.values(m.scores));const winners=max>0?m.players.filter(id=>m.scores[id]===max):[];
  finish(room,now,finishTurn,winners,winners.length?`Caption winner: ${winners.map(id=>room.players.find(p=>p.id===id).name).join(' & ')} (${max} vote${max===1?'':'s'}).`:'No captions received a vote.');
 }else{
  for(const [id,entry] of Object.entries(m.answers))if(entry.guessedTruth)m.scores[id]++;
  for(const [id,choice] of Object.entries(m.voters)){
   const owner=m.optionOwners[choice]?.owner;if(owner===null){if(!m.answers[id]?.guessedTruth)m.scores[id]++;}else if(owner)m.scores[owner]++;
  }
  const max=Math.max(...Object.values(m.scores));const winners=max>0?m.players.filter(id=>m.scores[id]===max):[];
  finish(room,now,finishTurn,winners,`The true answer was: ${m.secret.answer}. ${winners.length?'Best bluffers: '+winners.map(id=>room.players.find(p=>p.id===id).name).join(' & '):'Nobody scored'}.`);
 }
}
function finishMajorityRound(room,now,finishTurn,rng=crypto.randomInt){
 const m=room.board.minigame;const votes=Object.values(m.answers).map(a=>a.value),counts=[0,0,0,0];for(const n of votes)counts[n]++;
 const biggest=Math.max(...counts);if(biggest)for(const [id,a] of Object.entries(m.answers))if(counts[a.value]===biggest)m.scores[id]++;
 m.lastResult={question:m.question,winningOptions:counts.map((n,i)=>n===biggest&&biggest?i:-1).filter(i=>i>=0),totals:counts};
 if(m.round>=m.totalRounds){const top=Math.max(...Object.values(m.scores));const winners=top>0?m.players.filter(id=>m.scores[id]===top):[];finish(room,now,finishTurn,winners,`Majority Rules: ${winners.length?winners.map(id=>room.players.find(p=>p.id===id).name).join(' & ')+' know the crowd!':'No majority vote this time.'}`);return;}
 m.round++;prepareMajority(room,rng);setPhase(room,'play',now,15);
}
function finishRelay(room,now,finishTurn){
 const m=room.board.minigame,progress=m.display.progress,top=Math.max(...progress);const winningTeams=progress.map((n,i)=>n===top?i:-1).filter(i=>i>=0);
 const winners=top>0&&winningTeams.length===1?m.display.teams[winningTeams[0]]:[];
 finish(room,now,finishTurn,winners,winners.length?`Relay victory: Team ${winningTeams[0]+1} completed ${top} sums!`:'Relay finished without a clear winning team.',{team:true});
}
function finishBomb(room,now,finishTurn,success){finish(room,now,finishTurn,success?room.players.map(p=>p.id):[],success?'Bomb defused! Everybody earns a Spark; the host earns two.':'BOOM! The bomb went off. The host loses one Spark.',{bomb:true});}
function validActor(m,id){if(!m.players.includes(id))fail('AUTH','You are not a participant.');}
function submit(room,id,value,roundKey,now,finishTurn,rng=crypto.randomInt){
 const b=room.board,m=b.minigame;if(b.step!=='minigame'||!m||!SPECS[m.id])fail('STEP','No Create or Together game is active.');
 validActor(m,id);if(m.phase==='intro')fail('WAIT','The five-second TV introduction is still playing.');
 if(roundKey!==m.roundKey)fail('STALE','This phase has changed; use the current controls.');
 if(now>m.deadline)fail('LATE','Time is up.');
 const received=(kind='answer')=>{if(Object.hasOwn(m.answers,id))fail('ANSWERED',`You already submitted this ${kind}.`);};
 switch(m.id){
 case 'sketch-sabotage':{
  if(m.phase!=='play'||id===m.host||id===m.secret.saboteur)fail('ROLE','Only players guessing the picture can submit words.');
  const guess=enforceFamilyText(room,clean(value,55));m.guessCounts??={};m.guessCounts[id]=(m.guessCounts[id]||0)+1;if(m.guessCounts[id]>14)fail('LIMIT','Too many guesses.');
  if(normalize(guess)===normalize(m.secret.word)){m.secret.guesser=id;finishSketch(room,now,finishTurn);}break;
 }
 case 'noise-annoys':{
  if(id===m.host)fail('ROLE','You are acting out the sound, not guessing it.');
  const guess=enforceFamilyText(room,clean(value,65));m.guessCounts??={};m.guessCounts[id]=(m.guessCounts[id]||0)+1;if(m.guessCounts[id]>12)fail('LIMIT','Too many guesses.');
  if(isClueGuess(guess,m.secret.answer)||m.secret.aliases.some(alias=>isClueGuess(guess,alias))){m.secret.guesser=id;finishNoise(room,now,finishTurn);}break;
 }
 case 'caption-this':case 'fib-factory':{
  if(m.phase==='play'){
   received('entry');const text=enforceFamilyText(room,clean(value,m.id==='caption-this'?110:65));
   if(Object.values(m.answers).some(v=>v.text&&normalize(v.text)===normalize(text)))fail('INPUT','Please try a different answer.');
   // Accept an accidentally correct fib without revealing that it is correct.
   // It joins as a hidden truth prediction, not a duplicate ballot option.
   m.answers[id]=m.id==='fib-factory'&&normalize(text)===normalize(m.secret.answer)?{text:null,guessedTruth:true}:{text};
   if(Object.keys(m.answers).length===m.players.length)makeVoting(room,now,rng);
  }else if(m.phase==='vote'){
   if(Object.hasOwn(m.voters,id))fail('ANSWERED','You already voted.');
   if(!Number.isInteger(value)||value<0||value>=m.choices.length)fail('INPUT','Select one of the displayed answers.');
   if(m.optionOwners[value]?.owner===id)fail('INPUT','You cannot vote for your own entry.');
   m.voters[id]=value;
   if(Object.keys(m.voters).length===m.players.length)finishVoting(room,now,finishTurn);
  }else fail('STEP','Voting is not currently open.');break;
 }
 case 'mind-meld':{
  if(m.phase==='partner'){
   if(id!==m.host)fail('ROLE','Only the host chooses a partner.');
   const ids=m.players.filter(pid=>pid!==m.host);
   if(!Number.isInteger(value)||value<0||value>=ids.length)fail('INPUT','Choose a fellow contestant.');
   m.partner=ids[value];m.display.partnerId=m.partner;m.answers={};setPhase(room,'play',now,13);
  }else if(m.phase==='play'){
   if(id!==m.host&&id!==m.partner)fail('ROLE','Only the two partners enter words.');received();
   const word=enforceFamilyText(room,clean(value,32));if(!/^[\p{L}0-9 -]+$/u.test(word))fail('INPUT','Enter a simple word or short phrase.');
   m.answers[id]={text:word};if(Object.keys(m.answers).length===2)finishMeldRound(room,now,finishTurn);
  }else fail('STEP','Wait for the next attempt.');break;
 }
 case 'majority-rules':{
  if(m.phase!=='play')fail('STEP','This question is not open.');received();
  if(!Number.isInteger(value)||value<0||value>=4)fail('INPUT','Select one option.');
  m.answers[id]={value};if(Object.keys(m.answers).length===m.players.length)finishMajorityRound(room,now,finishTurn,rng);break;
 }
 case 'relay-sums':{
  if(m.phase!=='play')fail('STEP','Relay is not open.');
  const team=m.display.teams.findIndex(ids=>ids.includes(id)),index=m.display.progress[team],task=m.secret.tasks[team]?.[index];
  if(!task||task.id!==id)fail('TURN','Your teammate is answering the current sum.');
  if(!Number.isInteger(value)||value<0||value>1000)fail('INPUT','Enter an integer answer.');
  if(value===task.answer){m.display.progress[team]++;if(m.display.progress[team]>=m.secret.tasks[team].length)finishRelay(room,now,finishTurn);}
  else {m.misses??={};m.misses[id]=(m.misses[id]||0)+1;if(m.misses[id]>18)fail('LIMIT','Too many incorrect attempts.');}break;
 }
 case 'bomb-squad':{
  if(id!==m.host)fail('ROLE','The host operates the wires and keypad; share clues aloud.');
  if(m.phase!=='play')fail('STEP','The bomb is no longer active.');
  const secret=m.secret;
  if(secret.cut<4){
   if(typeof value!=='string'||!m.display.wires.includes(value)||m.display.cut.includes(value))fail('INPUT','Tap an uncut wire.');
   if(value!==secret.wires[secret.cut]){finishBomb(room,now,finishTurn,false);break;}
   secret.cut++;m.display.cut.push(value);if(secret.cut===4)m.display.keypadReady=true;
  }else{
   if(typeof value!=='string'||!/^\d{4}$/.test(value))fail('INPUT','Enter exactly four digits.');
   finishBomb(room,now,finishTurn,value===secret.digits.join(''));
  }break;
 }
 }
}
function finishMeldRound(room,now,finishTurn){
 const m=room.board.minigame;if(!m)return;
 const one=m.answers[m.host]?.text||'',two=m.answers[m.partner]?.text||'';
 if(one&&two&&normalize(one)===normalize(two)){
  finish(room,now,finishTurn,[m.host,m.partner],`${room.players.find(p=>p.id===m.host).name} and ${room.players.find(p=>p.id===m.partner).name} matched “${one}”!`,{team:true});return;
 }
 m.lastResult={words:[one||'(no word)',two||'(no word)'],attempt:m.round};
 if(m.round>=m.totalRounds){finish(room,now,finishTurn,[],`Mind Meld: ${m.totalRounds} tries and no matching word.`,{team:true});return;}
 m.phase='reveal';m.deadline=now+3000;room.board.deadline=m.deadline;
}
function draw(room,id,points,roundKey,now){
 const b=room.board,m=b.minigame;if(b.step!=='minigame'||!m||m.id!=='sketch-sabotage'||m.phase!=='play')fail('STEP','Drawing is not active.');
 if(roundKey!==m.roundKey||now>m.deadline)fail('STALE','That drawing round is over.');
 if(id!==m.host&&id!==m.secret.saboteur)fail('ROLE','Only the artist and secret saboteur can draw.');
 if(!Array.isArray(points)||points.length<2||points.length>70||points.some(x=>!Array.isArray(x)||x.length!==2||x.some(v=>!Number.isInteger(v)||v<0||v>1000)))fail('INPUT','Send a stroke of 2–70 normalised drawing points.');
 const count=m.strokeCounts[id]||0,limit=id===m.host?35:3;
 if(count>=limit)fail('LIMIT','You have used all your drawing strokes.');
 m.strokeCounts[id]=count+1;m.strokes.push({points});m.display.strokes=m.strokes;
}
function tick(room,now,finishTurn,rng=crypto.randomInt){
 const b=room.board,m=b.minigame;if(!m||b.step!=='minigame'||!SPECS[m.id])return false;
 if(now<m.deadline)return false;
 if(m.phase==='intro'){const phase=m.resumePhase;setPhase(room,phase,now,phase==='partner'?15:m.seconds);m.stageStarted=now;return true;}
 if(m.id==='sketch-sabotage'){finishSketch(room,now,finishTurn);return true;}
 if(m.id==='noise-annoys'){finishNoise(room,now,finishTurn);return true;}
 if(m.id==='caption-this'||m.id==='fib-factory'){
  if(m.phase==='play'){if(!makeVoting(room,now,rng))finish(room,now,finishTurn,[],`Nobody entered a ${m.id==='caption-this'?'caption':'fib'}.`);}
  else finishVoting(room,now,finishTurn);return true;
 }
 if(m.id==='mind-meld'){
  if(m.phase==='partner'){m.partner=m.players.find(id=>id!==m.host);m.display.partnerId=m.partner;m.answers={};setPhase(room,'play',now,13);}
  else if(m.phase==='play')finishMeldRound(room,now,finishTurn);
  else {m.round++;m.roundKey++;m.display.attempt=m.round;m.answers={};m.lastResult=null;setPhase(room,'play',now,13);}
  return true;
 }
 if(m.id==='majority-rules'){finishMajorityRound(room,now,finishTurn,rng);return true;}
 if(m.id==='relay-sums'){finishRelay(room,now,finishTurn);return true;}
 if(m.id==='bomb-squad'){finishBomb(room,now,finishTurn,false);return true;}
 return false;
}
function publicState(room,forTv=false,viewerId=null){
 const m=room.board.minigame;if(!m||!SPECS[m.id])return null;
 const safe={id:m.id,title:m.title,rule:m.rule,category:m.category,round:m.round,totalRounds:m.totalRounds,roundKey:m.roundKey,phase:m.phase,
  introUntil:m.introUntil,deadline:m.deadline,openAt:m.stageStarted,question:m.question,
  display:m.display,participants:m.players,answered:Object.keys(m.answers),voted:Object.keys(m.voters),scores:m.scores,lastResult:m.lastResult};
 if(m.id==='relay-sums'){
  safe.display={...m.display,activeIds:m.display.teams.map((group,team)=>m.secret.tasks[team][m.display.progress[team]]?.id||null)};
  if(viewerId){const team=m.display.teams.findIndex(group=>group.includes(viewerId));if(team>=0){const task=m.secret.tasks[team][m.display.progress[team]];if(task?.id===viewerId)safe.private={prompt:task.prompt,role:'relay-solver'};}}
 } else if(m.id==='mind-meld'&&m.phase==='partner'){
  safe.display={...m.display,partners:m.players.filter(id=>id!==m.host)};
 }else if(m.id==='sketch-sabotage'){
  safe.display={...m.display,strokeCount:m.strokeCounts[viewerId]||0};
  if(viewerId===m.secret.saboteur)safe.private={role:'saboteur',strokesLeft:Math.max(0,3-(m.strokeCounts[viewerId]||0))};
 }else if(m.id==='caption-this'||m.id==='fib-factory'){
  if(m.phase!=='vote')safe.display={...(m.id==='caption-this'?m.display:{}),entryCount:Object.keys(m.answers).length};
  if(m.phase==='vote'&&viewerId)safe.private={myEntryIndex:m.optionOwners.findIndex(o=>o.owner===viewerId)};
 }
 if(viewerId&&m.privateById[viewerId])safe.private={...(safe.private||{}),...m.privateById[viewerId]};
 if(m.id==='bomb-squad'&&viewerId===m.host)safe.private={...(safe.private||{}),role:'defuser'};
 return safe;
}
module.exports={CATALOG,SPECS,TWO_PLAYER_UNAVAILABLE,chooseGame,start,submit,draw,tick,publicState,normalize,clean,makeBomb,makeSums};
