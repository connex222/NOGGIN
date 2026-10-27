'use strict';
// Authoritative real-time round engine; no answer keys or counted objects go to phones.
const crypto=require('node:crypto');
const facts=require('../../data/higher-lower.json');
const closeCall=require('../../data/close-call.json');
const words=require('../../data/unscramble.json');
// Q1: real facts first. The old unit-conversion items (kind "arithmetic") are only
// used if a match somehow exhausts every real fact.
const FACTS=facts.filter(x=>x.kind!=='arithmetic'),FACTS_FALLBACK=facts.filter(x=>x.kind==='arithmetic');
const ESTIMATES=closeCall.filter(x=>x.kind!=='arithmetic'),ESTIMATES_FALLBACK=closeCall.filter(x=>x.kind==='arithmetic');
const groupOf=x=>x.group||x.id.split('-')[0];
// Two facts are "too obvious" to compare when one is more than three times the other.
const closeEnough=(a,b)=>{const lo=Math.min(Math.abs(a),Math.abs(b)),hi=Math.max(Math.abs(a),Math.abs(b));return lo>0&&hi/lo<=3;};
function pickPair(m,rng){
 for(const pool of [FACTS,FACTS_FALLBACK]){
  if(!pool.length)continue;
  const fresh=pool.filter(x=>!m.usedIds.includes(x.id));
  const partnersOf=a=>fresh.filter(b=>b!==a&&groupOf(b)===groupOf(a)&&b.value!==a.value);
  // Prefer a fact with an unused partner from its own group that is close in size
  // (a real question). Real facts always have one; the arithmetic fallback may not.
  const nearStarters=fresh.filter(a=>partnersOf(a).some(b=>closeEnough(a.value,b.value)));
  const starters=nearStarters.length?nearStarters:(pool===FACTS?[]:fresh.filter(a=>partnersOf(a).length));
  if(!starters.length)continue;
  const a=pick(starters,rng);
  const partners=partnersOf(a),near=partners.filter(b=>closeEnough(a.value,b.value));
  return [a,pick(near.length?near:partners,rng)];
 }
 // Every fact used: start again from the real facts.
 m.usedIds=[];return pickPair(m,rng);
}
function pickEstimate(m,rng){
 const fresh=ESTIMATES.filter(q=>!m.usedIds.includes(q.id));
 if(fresh.length)return pick(fresh,rng);
 const fallback=ESTIMATES_FALLBACK.filter(q=>!m.usedIds.includes(q.id));
 return pick(fallback.length?fallback:(ESTIMATES.length?ESTIMATES:closeCall),rng);
}
const SPECS=Object.freeze({
 'quick-draw':{name:'Quick Draw',category:'speed',rounds:3,rule:'Wait for DRAW! First clean tap takes the point. Tap early and you misfire.'},
 'count-flash':{name:'Count Flash',category:'speed',rounds:3,rule:'SURPRISE TARGET! Memorise all three types of object; only AFTER the flash will you learn which one to count.'},
 'odd-spot':{name:'Odd Spot',category:'speed',rounds:5,rule:'Find the different symbol. Tap the matching square on your phone. Wrong taps lock for three seconds.'},
 'colour-clash':{name:'Colour Clash',category:'speed',rounds:8,rule:'Tap the COLOUR of the ink, not the colour word. Correct +1; wrong −1.'},
 'higher-lower':{name:'Higher or Lower',category:'brain',rounds:8,rule:'Higher or lower? You have TWO strikes before you are eliminated — survive and earn points.'},
 'memory-lane':{name:'Memory Lane',category:'brain',rounds:4,rule:'Copy the pad sequence. In the FINAL round, play it BACKWARDS!'},
 'close-call':{name:'Close Call',category:'brain',rounds:3,rule:'Make a numerical guess. Closest scores the best placing across three questions. Same guess? The quicker answer ranks higher.'},
 'unscramble':{name:'Unscramble',category:'brain',rounds:3,rule:'Solve the anagram from its category clue. First correct answer scores.'}
});
const REVEAL_MS=2800,REVEAL_RELAXED_MS=4000;
// D7: below 100 ms is anticipation, not reaction. Phone clocks may be a little out, so
// a tap up to 1 s before the server's DRAW time is allowed if the phone says it showed DRAW.
const MIN_REACTION_MS=100,CLOCK_SLACK_MS=1000;
const CATALOG=Object.entries(SPECS).map(([id,spec])=>({id,...spec}));
function bad(code,msg){const e=new Error(msg);e.code=code;throw e;}
function pick(pool,rng){return pool[rng(pool.length)];}
function permutation(s,rng){const a=s.split('');for(let i=a.length-1;i>0;i--){const j=rng(i+1);[a[i],a[j]]=[a[j],a[i]];}return a.join('');}
// Q2: a random shuffle must never spell something rude on the TV
// (INSECT once scrambled to INCEST). Any scramble containing one of these is redrawn.
const RUDE_FRAGMENTS=Object.freeze(['INCEST','ARSE','ANUS','BUM','COCK','CUM','CUNT','DICK','FART','FUCK','KNOB','NOB','PENIS','PISS','POO','PORN','PRICK','PUBE','SEX','SHAG','SHIT','SLAG','SLUT','TIT','TURD','TWAT','WANK','BOOB','CRAP','NAZI','TAMPON','BORDEL']);
function rude(text){return RUDE_FRAGMENTS.some(f=>text.includes(f));}
// Q3: the scramble must not itself be an accepted answer (OCEANS shown as CANOES).
function safeScramble(word,rng,avoid=[]){
 const bad=s=>s===word||avoid.includes(s)||rude(s);
 for(let attempt=0;attempt<30;attempt++){const s=permutation(word,rng);if(!bad(s))return s;}
 // Deterministic fallback: the first rotation that is neither an answer nor rude.
 for(let k=1;k<word.length;k++){const s=word.slice(k)+word.slice(0,k);if(!bad(s))return s;}
 return word.slice(1)+word[0];
}
function chooseGame(b,category,rng=crypto.randomInt){
 const ids=CATALOG.filter(x=>x.category===category).map(x=>x.id);
 const never=ids.filter(id=>!b.seenGames?.includes(id));
 const pool=(never.length?never:ids).filter(id=>id!==b.lastGame);
 const id=pick(pool.length?pool:ids,rng);b.lastGame=id;b.seenGames=[...(b.seenGames||[]),id].slice(-12);return id;
}
function roundsFor(room,id){
 // Preserve the original Classic rule lengths; Showtime has five progressive stages.
 return room.settings.rules==='showtime' ? Math.max(5, SPECS[id].rounds) : SPECS[id].rounds;
}
// D8: colour-blind safe rooms swap Colour Clash for Shape Clash (same scoring/timing).
const COLOURS=['RED','BLUE','GREEN','YELLOW'],SHAPES=['CIRCLE','SQUARE','TRIANGLE','STAR'];
function shapeMode(room){return room.settings?.colourBlindSafe===true;}
function titleFor(room,id){return id==='colour-clash'&&shapeMode(room)?'Shape Clash':SPECS[id].name;}
function ruleFor(room,id){
 if(id==='colour-clash'&&shapeMode(room))return 'Tap the SHAPE you see, not the shape word written inside it. Correct +1; wrong −1.';
 if(room.settings.rules!=='showtime'&&id==='count-flash')return 'The target symbol is shown before the flash. Count only that symbol on the TV.';
 if(room.settings.rules!=='showtime'&&id==='memory-lane')return 'Copy the TV pad sequence in its original order, including the final round.';
 return SPECS[id].rule;
}
function start(room,category,now,rng=crypto.randomInt,forcedId=null){
 const b=room.board,id=forcedId||chooseGame(b,category,rng),spec=SPECS[id];
 if(!spec||spec.category!==category)bad('GAME','Unrecognised mini-game.');
 const players=room.players.map(p=>p.id);
 b.minigame={id,category,round:0,roundKey:0,phase:'',deadline:0,openAt:0,roundAnswers:{},progress:{},blocked:{},attempts:{},usedIds:[],memorySequence:[],scores:Object.fromEntries(players.map(id=>[id,0])),players,eliminated:[],bestLengths:Object.fromEntries(players.map(id=>[id,0])),strikes:Object.fromEntries(players.map(id=>[id,0])),lastFeedback:'',privateTv:null,secret:null,question:'',hint:'',display:{},lastRoundResult:null};
 b.step='minigame';b.challenge=null;b.result=null;
 nextRound(room,now,rng);
 // Studio rule card and five-second visual preview before the first timed round.
 const m=b.minigame;
 // Long enough to read the three how-to-play steps on the TV and phone.
 const intro=room.settings.timerSpeed==='relaxed'?6000:4500;
 m.introUntil=now+intro;m.resumePhase=m.phase;m.phase='intro';
 m.openAt+=intro;m.deadline+=intro;
 for(const key of ['readyAt','flashEndsAt','revealAt'])if(Number.isFinite(m.display[key]))m.display[key]+=intro;
 b.deadline=m.deadline;
 b.event={type:'minigame',category,text:`${spec.name}: ${ruleFor(room,id)}`};
 return b.minigame;
}
function fresh(m,now){m.round++;m.roundKey++;m.phase='play';m.roundAnswers={};m.progress={};m.blocked={};m.attempts={};m.privateTv=null;m.lastRoundResult=null;m.openAt=now;m.deadline=now+12_000;m.question='';m.hint='';m.display={};}
function nextRound(room,now,rng=crypto.randomInt){
 const m=room.board.minigame;if(!m)return;
 const spec=SPECS[m.id];fresh(m,now);
 const relaxed=room.settings.timerSpeed==='relaxed'?1.45:1;
 const set=(ms)=>{m.deadline=now+Math.round(ms*relaxed);};
 switch(m.id){
 case 'quick-draw':{
   const wait=2000+rng(4001);m.phase='wait';m.openAt=now+wait;m.deadline=m.openAt+Math.round(Math.max(1900,3500-(m.round-1)*300)*relaxed);
   m.question='Wait for the signal…';m.display={readyAt:m.openAt,difficulty:m.round};break;
 }
 case 'count-flash':{
   const pool=['🦆','⚽','☕','⭐','🍎'];
   const icons=[];for(let i=0;i<3;i++)icons.push(pool.splice(rng(pool.length),1)[0]);
   // Showtime ramps the number of objects, not just the timer. Classic keeps 36.
   const total=room.settings.rules==='showtime'?Math.min(36,6+m.round*6):36;
   const first= Math.floor(total/3),second=Math.floor(total/3);
   const counts=[first,second,total-first-second];
   const target=rng(3),count=counts[target];
   m.secret={count,targetIcon:icons[target]};m.phase='flash';m.openAt=now+Math.max(1250,3000-(m.round-1)*350);m.deadline=m.openAt+Math.round(Math.max(5200,8500-(m.round-1)*500)*relaxed);
   m.question=room.settings.rules==='showtime'?'MEMORISE ALL THREE SYMBOLS — THE TARGET IS A SURPRISE!':`COUNT THE ${icons[target]} SYMBOLS ON THE TV!`;
   m.privateTv={count,icon:icons[0],distractor:icons[1],icons,counts,total,seed:rng(1000000)};
   m.display={flashEndsAt:m.openAt,targetIcon:room.settings.rules==='showtime'?null:icons[target],difficulty:m.round,objectTotal:total};break;
 }
 case 'odd-spot':{
   const index=rng(36),level=m.round;
   // The visual puzzle is intentionally shared with both screens; the answer index stays server-only.
   const pair=pick([['●','◆'],['★','✦'],['▲','■'],['♥','◆']],rng);
   const symbol=level<=2?pair[0]:level<=4?'▲':'●';
   const oddSymbol=level<=2?pair[1]:symbol;
   const grid=Array.from({length:36},(_,i)=>i===index?oddSymbol:symbol);
   const styles=Array.from({length:36},(_,i)=>({
     rotation:level>=3&&level<=4&&i===index?level===3?90:180:0,
     // D15: level 5 used two near-identical shades that vanish in sunlight.
     // It now uses a size difference instead: one symbol is drawn smaller.
     scale:level===5&&i===index?0.68:null
   }));
   m.secret={index};
   m.question=level<=2?'Find the different shape.':level<=4?'Find the rotated shape.':'Find the slightly smaller shape.';
   m.display={grid,styles,level};set(level===5?11000:9500);break;
 }
 case 'colour-clash':{
   const shape=shapeMode(room),labels=shape?SHAPES:COLOURS;const word=rng(4),ink=(word+1+rng(3))%4;
   // In Shape Clash the "ink" is the outline shape drawn around the word.
   m.secret={ink};m.question=labels[word];m.display=shape?{mode:'shape',shape:labels[ink],word:labels[word],difficulty:m.round}:{ink:labels[ink],word:labels[word],difficulty:m.round};set(room.settings.rules==='showtime'?Math.max(1400,2800-(m.round-1)*180):2500);break;
 }
 case 'higher-lower':{
   const [a,b]=pickPair(m,rng);
   m.usedIds.push(a.id,b.id);
   m.secret={answer:b.value>a.value?0:1,actual:b.value};
   m.question=`${a.label}: ${a.value}${a.unit?' '+a.unit:''}. ${b.label}: higher or lower?`;
   m.display={options:['HIGHER','LOWER'],difficulty:m.round};set(room.settings.rules==='showtime'?Math.max(3600,6800-(m.round-1)*400):6000);break;
 }
 case 'memory-lane':{
   m.memorySequence.push(rng(6));if(m.round===1)m.memorySequence.push(rng(6));
   const sequence=m.memorySequence.slice();
   m.secret={sequence};m.phase='flash';m.openAt=now+1000+sequence.length*750;m.deadline=m.openAt+Math.round(8500*relaxed);
   m.question=m.round===roundsFor(room,m.id)&&room.settings.rules==='showtime'?'FINAL ROUND: watch the pads, then tap them in REVERSE order!':'Watch the TV pads, then repeat the sequence in the SAME order.';
   m.privateTv={sequence};m.display={padCount:6,sequenceLength:sequence.length,flashEndsAt:m.openAt,reverse:room.settings.rules==='showtime'&&m.round===roundsFor(room,m.id)};break;
 }
 case 'close-call':{
   const item=pickEstimate(m,rng);m.usedIds.push(item.id);m.secret={answer:item.answer};m.question=item.question;m.display={unit:item.unit,difficulty:m.round};set(room.settings.rules==='showtime'?Math.max(7000,12000-(m.round-1)*1100):11500);break;
 }
 case 'unscramble':{
   const freshWords=words.filter(q=>!m.usedIds.includes(q.id));
   // Longer words are a transparent difficulty increase, unlike merely shortening the clock.
   const pool=freshWords.length?freshWords:words;
   const ordered=[...pool].sort((a,b)=>a.word.length-b.word.length);
   const band=room.settings.rules==='showtime'
    ?Math.min(4,m.round-1):null;
   const from=band===null?0:Math.floor(ordered.length*band/5);
   const to=band===null?ordered.length:Math.max(from+1,Math.ceil(ordered.length*(band+1)/5));
   const candidates=ordered.slice(from,to);
   const item=pick(candidates.length?candidates:pool,rng);
   m.usedIds.push(item.id);const shuffle=safeScramble(item.word,rng,item.accept||[]);
   // Q3: other real words using all the same letters also count (e.g. OCEANS / CANOES).
   m.secret={answer:item.word,accept:[item.word,...(item.accept||[])]};m.question=shuffle.split('').join(' ');m.hint=item.category;
   m.display={hint:item.category,revealAt:now+(room.settings.rules==='showtime'?Math.min(7500,5000+(m.round-1)*650):5000),wordLength:item.word.length,difficulty:m.round};set(10500);break;
 }
 }
 room.board.deadline=m.deadline;
}
function eligible(m,id){return m.players.includes(id)&&!m.eliminated.includes(id);}
function finished(m){return m.players.filter(id=>eligible(m,id)).every(id=>m.roundAnswers[id]);}
function submit(room,id,value,roundKey,now){
 const b=room.board,m=b.minigame;if(b.step!=='minigame'||!m)bad('STEP','No mini-game is running.');
 if(m.phase==='intro'||m.phase==='reveal')bad('WAIT',m.phase==='reveal'?'The answer is being revealed. Next round starts shortly.':'Watch the five-second game demo on the TV first.');
 if(roundKey!==m.roundKey)bad('STALE','That mini-game round has already changed.');
 if(!eligible(m,id))bad('PLAYER','You are watching this round, not playing.');
 if(now>m.deadline)bad('LATE','This round has ended.');
 if(m.roundAnswers[id])bad('ANSWERED','You have already completed this round.');
 if(m.blocked[id]&&now<m.blocked[id])bad('WAIT','Wait for your mistake penalty to end.');
 // D7: Quick Draw may send {value:1, reactionMs} measured on the phone.
 const quickTap=m.id==='quick-draw'&&value&&typeof value==='object'&&!Array.isArray(value);
 if(!quickTap&&typeof value!=='number'&&typeof value!=='string')bad('INPUT','Invalid answer.');
 if(typeof value==='string'&&(value.length>40||/[<>\u0000-\u001f]/.test(value)))bad('INPUT','Invalid text input.');
 const a=m.roundAnswers;const secret=m.secret||{};
 switch(m.id){
 case 'quick-draw':{
   // D7: reaction time is measured on each phone from the moment IT showed DRAW, so the
   // phone nearest the router no longer wins. This is a living-room game between
   // friends, so trusting the phone's own timing is acceptable. Taps before DRAW, or
   // impossibly fast (under 100 ms, i.e. guessing), are misfires.
   const tap=quickTap?value:{value};
   if(tap.value!==1)bad('INPUT','Tap the DRAW button.');
   const windowMs=m.deadline-m.openAt,claimed=Number(tap.reactionMs);
   if(quickTap&&Object.hasOwn(tap,'reactionMs')){
    if(!Number.isFinite(claimed))bad('INPUT','Invalid reaction time.');
    const valid=claimed>=MIN_REACTION_MS&&claimed<=windowMs&&now>=m.openAt-CLOCK_SLACK_MS;
    a[id]=valid?{correct:true,at:now,reactionMs:Math.round(claimed)}:{correct:false,at:now,misfire:true};
   }else a[id]=now>=m.openAt?{correct:true,at:now,reactionMs:now-m.openAt}:{correct:false,at:now,misfire:true};
   break;
 }
 case 'count-flash':{
   if(now<m.openAt)bad('WAIT','Watch the objects first.');
   if(!Number.isInteger(value)||value<0||value>999)bad('INPUT','Enter a number from 0 to 999.');
   a[id]={guess:value,distance:Math.abs(value-secret.count),at:now};break;
 }
 case 'odd-spot':{
   if(!Number.isInteger(value)||value<0||value>=36)bad('INPUT','Choose a square from the grid.');
   m.attempts[id]=(m.attempts[id]||0)+1;
   if(m.attempts[id]>12)bad('LIMIT','Too many attempts this round.');
   if(value!==secret.index){m.blocked[id]=now+3000;return;}
   a[id]={correct:true,at:now};break;
 }
 case 'colour-clash':case 'higher-lower':{
   if(!Number.isInteger(value)||value<0||value>=(m.id==='colour-clash'?4:2))bad('INPUT','Select a valid button.');
   a[id]={correct:value===(m.id==='colour-clash'?secret.ink:secret.answer),at:now};break;
 }
 case 'memory-lane':{
   if(now<m.openAt)bad('WAIT','Watch the TV pattern first.');
   if(!Number.isInteger(value)||value<0||value>=6)bad('INPUT','Select a coloured pad.');
   const n=m.progress[id]||0;
   if(value!==(m.display.reverse?secret.sequence[secret.sequence.length-1-n]:secret.sequence[n])){a[id]={correct:false,length:n,at:now};m.bestLengths[id]=Math.max(m.bestLengths[id]||0,n);break;}
   m.progress[id]=n+1;m.bestLengths[id]=Math.max(m.bestLengths[id]||0,n+1);
   if(n+1===secret.sequence.length)a[id]={correct:true,length:n+1,at:now};
   break;
 }
 case 'close-call':{
   if(!Number.isInteger(value)||value<0||value>100000000)bad('INPUT','Enter a whole number from 0 to 100 million.');
   a[id]={guess:value,distance:Math.abs(value-secret.answer),at:now};break;
 }
 case 'unscramble':{
   if(typeof value!=='string'||!/^[a-zA-Z ]{1,40}$/.test(value))bad('INPUT','Type letters only.');
   m.attempts[id]=(m.attempts[id]||0)+1;
   if(m.attempts[id]>8)bad('LIMIT','No attempts remaining this round.');
   if(!(secret.accept||[secret.answer]).includes(value.trim().toUpperCase().replace(/ /g,''))){m.blocked[id]=now+800;return;}
   a[id]={correct:true,at:now};break;
 }
 }
 // Avoid advancing inside submit: quick-draw and odd-spot must wait for a level's
 // deadline to let other players finish and prevent timestamp-based race bias.
 if(finished(m)){m.deadline=Math.min(m.deadline,now+450);b.deadline=m.deadline;}
}
function concludeRound(room){
 const m=room.board.minigame,s=m.scores,entries=Object.entries(m.roundAnswers);
 const score=(id,n)=>{s[id]=(s[id]||0)+n;};
 let winner=[];
 switch(m.id){
 case 'odd-spot':{
   winner=entries.filter(([,a])=>a.correct).map(([id])=>id);winner.forEach(id=>score(id,1));break;
 }
 case 'quick-draw':{
   // D7: the fastest valid reaction wins, not the first message to reach the server.
   const correct=entries.filter(([,a])=>a.correct).sort((a,b)=>a[1].reactionMs-b[1].reactionMs);
   if(correct.length){const best=correct[0][1].reactionMs;winner=correct.filter(([,a])=>a.reactionMs===best).map(([id])=>id);winner.forEach(id=>score(id,1));}
   m.revealReactions=correct.map(([id,a])=>({id,reactionMs:a.reactionMs}));break;
 }
 case 'unscramble':{
   const correct=entries.filter(([,a])=>a.correct).sort((a,b)=>a[1].at-b[1].at);
   if(correct.length){const first=correct[0][1].at;winner=correct.filter(([,a])=>a.at===first).map(([id])=>id);winner.forEach(id=>score(id,1));}break;
 }
 case 'count-flash':{
   if(entries.length){let smallest=Math.min(...entries.map(([,a])=>a.distance));winner=entries.filter(([,a])=>a.distance===smallest).map(([id])=>id);
     winner.forEach(id=>score(id,2));entries.filter(([,a])=>a.distance===0).forEach(([id])=>score(id,2));}break;
 }
 case 'colour-clash':{
   entries.forEach(([id,a])=>score(id,a.correct?1:-1));winner=entries.filter(([,a])=>a.correct).map(([id])=>id);break;
 }
 case 'higher-lower':{
   entries.forEach(([id,a])=>{if(a.correct){score(id,1);winner.push(id);}else {m.strikes[id]=(m.strikes[id]||0)+1;if(m.strikes[id]>=2)m.eliminated.push(id);}});
   for(const id of m.players)if(eligible(m,id)&&!m.roundAnswers[id]){m.strikes[id]=(m.strikes[id]||0)+1;if(m.strikes[id]>=2)m.eliminated.push(id);}
   break;
 }
 case 'memory-lane':{
   entries.forEach(([id,a])=>{score(id,a.length||0);if(a.correct)winner.push(id);});break;
 }
 case 'close-call':{
   // Place-based scoring balances questions with very different numerical scales.
   // Q1: closest wins; an exact tie on distance goes to whoever locked in first.
   const order=[...entries].sort((x,y)=>x[1].distance-y[1].distance||x[1].at-y[1].at);
   order.forEach(([id],place)=>score(id,Math.max(0,8-place)));
   winner=order.length?[order[0][0]]:[];
   // Q8: every guess, closest first, for the TV reveal.
   m.revealGuesses=order.map(([id,a])=>({id,guess:a.guess,distance:a.distance}));break;
 }
 }
 m.lastRoundResult={round:m.round,winners:winner,...(m.id==='close-call'?{guesses:m.revealGuesses||[],unit:m.display.unit}:{}),...(m.id==='quick-draw'?{reactions:m.revealReactions||[]}:{}),answer:(m.id==='unscramble'?m.secret.answer:m.id==='count-flash'?m.secret.count:m.id==='close-call'?m.secret.answer:m.id==='higher-lower'?m.secret.actual:undefined),scoreboard:{...s}};
 return winner;
}
function winners(m){
 const scoring=m.id==='memory-lane'?m.bestLengths:m.scores;
 const best=Math.max(...Object.values(scoring));
 return m.players.filter(id=>scoring[id]===best && (best>0 || m.id==='colour-clash'));
}
function advance(room,now,finishTurn,rng=crypto.randomInt){
 const b=room.board,m=b.minigame;if(!m)return;
 // Server-owned 2.8s reveal (4.0s relaxed): correct answers stay hidden until reveal.
 // The round key remains stable during reveal; late inputs are rejected.
 if(m.phase==='reveal'){if(!m.finalReveal){nextRound(room,now,rng);return;}}
 else{
  concludeRound(room);
  const stop=m.round>=roundsFor(room,m.id)||(m.id==='higher-lower'&&m.players.filter(id=>eligible(m,id)).length<=1);
  // Q8: long enough to read the answer (and, in Close Call, everyone's guesses).
  // The final round is revealed too, so nobody misses the last answer.
  m.phase='reveal';m.finalReveal=stop;m.deadline=now+(room.settings.timerSpeed==='relaxed'?REVEAL_RELAXED_MS:REVEAL_MS);b.deadline=m.deadline;return;
 }
 const win=winners(m),host=room.players.find(p=>p.id===b.activeId);
 // Preserve Phase 2 scoring: host +2 if winning; other winners +1.
 for(const p of room.players)if(win.includes(p.id))p.sparks+=(p.id===host.id?2:1);
 // The host loses a Spark only if strictly last on the leaderboard for this mini-game.
 // G5: if everyone finished level, nobody is "last", so the host keeps their Spark.
 const values=m.id==='memory-lane'?m.bestLengths:m.scores;
 const min=Math.min(...Object.values(values)),max=Math.max(...Object.values(values));
 if(max>min&&values[host.id]===min&&!win.includes(host.id))host.sparks=Math.max(0,host.sparks-1);
 const ranking=[...room.players].sort((a,z)=>values[z.id]-values[a.id]).map(p=>`${p.name}: ${values[p.id]}`);
 const description=`${SPECS[m.id].name}: ${win.length?win.map(id=>room.players.find(p=>p.id===id)?.name).join(' & ')+' won':'No winner'}! · ${ranking.join(' · ')}`;
 b.minigame=null;finishTurn(room,now,description,win);
}
function tick(room,now,finishTurn,rng=crypto.randomInt){
 const b=room.board,m=b.minigame;if(b.step!=='minigame'||!m)return false;
 let changed=false;
 if(m.phase==='intro'){if(now<m.introUntil)return false;m.phase=m.resumePhase;delete m.resumePhase;changed=true;}
 if(m.id==='unscramble'&&m.display.revealAt&&!m.display.clue&&now>=m.display.revealAt){
   m.display.clue=m.secret.answer[0]+' _'.repeat(m.secret.answer.length-1);changed=true;
 }
 if(m.phase==='wait'&&now>=m.openAt){m.phase='play';m.question='DRAW! Tap NOW!';changed=true;}
 if(m.phase==='flash'&&now>=m.openAt){m.phase='play';if(m.id==='count-flash'){m.display.targetIcon=m.secret.targetIcon;m.question=`How many ${m.secret.targetIcon} did you see?`;}
   else m.question=m.display.reverse?'REVERSE THE SEQUENCE ON YOUR PHONE!':'Repeat the TV sequence on your phone!';changed=true;}
 if(now>=m.deadline){advance(room,now,finishTurn,rng);return true;}
 return changed;
}
function publicState(room,forTv=false){
 const m=room.board.minigame;if(!m)return null;
 const spec=SPECS[m.id];
 return {id:m.id,category:m.category,title:titleFor(room,m.id),rule:ruleFor(room,m.id),round:m.round,totalRounds:roundsFor(room,m.id),roundKey:m.roundKey,phase:m.phase,introUntil:m.introUntil||null,question:m.question,hint:m.hint,display:m.display,deadline:m.deadline,openAt:m.openAt,participants:m.players,eliminated:m.eliminated,answered:Object.keys(m.roundAnswers),progress:m.progress,scores:m.scores,strikes:m.strikes,blocked:m.blocked,
  ...(m.phase==='reveal'?{lastRoundResult:m.lastRoundResult,finalReveal:Boolean(m.finalReveal)}:{}),
  ...(forTv&&m.privateTv?{tvCue:m.privateTv}:{})};
}
module.exports={MIN_REACTION_MS,COLOURS,SHAPES,titleFor,REVEAL_MS,REVEAL_RELAXED_MS,FACTS,ESTIMATES,groupOf,closeEnough,CATALOG,SPECS,chooseGame,start,submit,tick,publicState,winners,concludeRound,nextRound,advance,safeScramble,RUDE_FRAGMENTS};
