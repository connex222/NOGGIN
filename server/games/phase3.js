'use strict';
// Authoritative real-time round engine; no answer keys or counted objects go to phones.
const crypto=require('node:crypto');
const facts=require('../../data/higher-lower.json');
const closeCall=require('../../data/close-call.json');
const words=require('../../data/unscramble.json');
const SPECS=Object.freeze({
 'quick-draw':{name:'Quick Draw',category:'speed',rounds:3,rule:'Wait for DRAW! First clean tap takes the point. Tap early and you misfire.'},
 'count-flash':{name:'Count Flash',category:'speed',rounds:3,rule:'SURPRISE TARGET! Memorise all three types of object; only AFTER the flash will you learn which one to count.'},
 'odd-spot':{name:'Odd Spot',category:'speed',rounds:5,rule:'Find the different symbol. Tap the matching square on your phone. Wrong taps lock for three seconds.'},
 'colour-clash':{name:'Colour Clash',category:'speed',rounds:8,rule:'Tap the COLOUR of the ink, not the colour word. Correct +1; wrong −1.'},
 'higher-lower':{name:'Higher or Lower',category:'brain',rounds:8,rule:'Higher or lower? You have TWO strikes before you are eliminated — survive and earn points.'},
 'memory-lane':{name:'Memory Lane',category:'brain',rounds:4,rule:'Copy the pad sequence. In the FINAL round, play it BACKWARDS!'},
 'close-call':{name:'Close Call',category:'brain',rounds:3,rule:'Make a numerical guess. Closest scores the best placing across three questions.'},
 'unscramble':{name:'Unscramble',category:'brain',rounds:3,rule:'Solve the anagram from its category clue. First correct answer scores.'}
});
const CATALOG=Object.entries(SPECS).map(([id,spec])=>({id,...spec}));
function bad(code,msg){const e=new Error(msg);e.code=code;throw e;}
function pick(pool,rng){return pool[rng(pool.length)];}
function permutation(s,rng){const a=s.split('');for(let i=a.length-1;i>0;i--){const j=rng(i+1);[a[i],a[j]]=[a[j],a[i]];}return a.join('');}
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
function ruleFor(room,id){
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
 const m=b.minigame;const intro=room.settings.timerSpeed==='relaxed'?5000:3300;m.introUntil=now+intro;m.resumePhase=m.phase;m.phase='intro';
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
     tone:level===5?(i===index?'#c7d3ed':'#e7efff'):null
   }));
   m.secret={index};
   m.question=level<=2?'Find the different shape.':level<=4?'Find the rotated shape.':'Find the slightly different shade.';
   m.display={grid,styles,level};set(level===5?11000:9500);break;
 }
 case 'colour-clash':{
   const labels=['RED','BLUE','GREEN','YELLOW'];const word=rng(4),ink=(word+1+rng(3))%4;
   m.secret={ink};m.question=labels[word];m.display={ink:labels[ink],word:labels[word],difficulty:m.round};set(room.settings.rules==='showtime'?Math.max(1400,2800-(m.round-1)*180):2500);break;
 }
 case 'higher-lower':{
   const available=facts.filter(x=>!m.usedIds.includes(x.id));const a=pick(available.length>1?available:facts,rng);
   const prefix=a.id.split('-')[0];const same=facts.filter(x=>x.id.startsWith(prefix+'-')&&x.value!==a.value&&!m.usedIds.includes(x.id));
   const options=same.length?same:facts.filter(x=>x.id.startsWith(prefix+'-')&&x.value!==a.value);const b=pick(options,rng);
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
   const pool=closeCall.filter(q=>!m.usedIds.includes(q.id));const item=pick(pool.length?pool:closeCall,rng);m.usedIds.push(item.id);m.secret={answer:item.answer};m.question=item.question;m.display={unit:item.unit,difficulty:m.round};set(room.settings.rules==='showtime'?Math.max(7000,12000-(m.round-1)*1100):11500);break;
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
   m.usedIds.push(item.id);let shuffle=permutation(item.word,rng);
   if(shuffle===item.word)shuffle=item.word.slice(1)+item.word[0];
   m.secret={answer:item.word};m.question=shuffle.split('').join(' ');m.hint=item.category;
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
 if(typeof value!=='number'&&typeof value!=='string')bad('INPUT','Invalid answer.');
 if(typeof value==='string'&&(value.length>40||/[<>\u0000-\u001f]/.test(value)))bad('INPUT','Invalid text input.');
 const a=m.roundAnswers;const secret=m.secret||{};
 switch(m.id){
 case 'quick-draw':{
   if(value!==1)bad('INPUT','Tap the DRAW button.');
   a[id]={correct:now>=m.openAt,at:now};break;
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
   a[id]={correct:value===(m.id==='colour-clash'?['RED','BLUE','GREEN','YELLOW'].indexOf(m.display.ink):secret.answer),at:now};break;
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
   if(value.trim().toUpperCase().replace(/ /g,'')!==secret.answer){m.blocked[id]=now+800;return;}
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
 case 'quick-draw':case 'unscramble':{
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
   const ranked=[...new Set(entries.map(([,a])=>a.distance))].sort((a,b)=>a-b);
   entries.forEach(([id,a])=>score(id,Math.max(0,8-ranked.indexOf(a.distance))));
   winner=entries.filter(([,a])=>a.distance===ranked[0]).map(([id])=>id);break;
 }
 }
 m.lastRoundResult={round:m.round,winners:winner,answer:(m.id==='unscramble'?m.secret.answer:m.id==='count-flash'?m.secret.count:m.id==='close-call'?m.secret.answer:m.id==='higher-lower'?m.secret.actual:undefined),scoreboard:{...s}};
 return winner;
}
function winners(m){
 const scoring=m.id==='memory-lane'?m.bestLengths:m.scores;
 const best=Math.max(...Object.values(scoring));
 return m.players.filter(id=>scoring[id]===best && (best>0 || m.id==='colour-clash'));
}
function advance(room,now,finishTurn,rng=crypto.randomInt){
 const b=room.board,m=b.minigame;if(!m)return;
 // Server-owned 1.8s reveal: no client receives correct answers before this.
 // The round key remains stable during reveal; late inputs are rejected.
 if(m.phase==='reveal'){nextRound(room,now,rng);return;}
 concludeRound(room);
 const stop=m.round>=roundsFor(room,m.id)||(m.id==='higher-lower'&&m.players.filter(id=>eligible(m,id)).length<=1);
 if(!stop){m.phase='reveal';m.deadline=now+(room.settings.timerSpeed==='relaxed'?2400:1200);b.deadline=m.deadline;return;}
 const win=winners(m),host=room.players.find(p=>p.id===b.activeId);
 // Preserve Phase 2 scoring: host +2 if winning; other winners +1.
 for(const p of room.players)if(win.includes(p.id))p.sparks+=(p.id===host.id?2:1);
 // The host loses a Spark only if strictly last on the leaderboard for this mini-game.
 const values=m.id==='memory-lane'?m.bestLengths:m.scores;
 const min=Math.min(...Object.values(values));
 if(values[host.id]===min&&!win.includes(host.id))host.sparks=Math.max(0,host.sparks-1);
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
 return {id:m.id,category:m.category,title:spec.name,rule:ruleFor(room,m.id),round:m.round,totalRounds:roundsFor(room,m.id),roundKey:m.roundKey,phase:m.phase,introUntil:m.introUntil||null,question:m.question,hint:m.hint,display:m.display,deadline:m.deadline,openAt:m.openAt,participants:m.players,eliminated:m.eliminated,answered:Object.keys(m.roundAnswers),progress:m.progress,scores:m.scores,strikes:m.strikes,blocked:m.blocked,
  ...(m.phase==='reveal'?{lastRoundResult:m.lastRoundResult}:{}),
  ...(forTv&&m.privateTv?{tvCue:m.privateTv}:{})};
}
module.exports={CATALOG,SPECS,chooseGame,start,submit,tick,publicState,winners,concludeRound,nextRound,advance};
