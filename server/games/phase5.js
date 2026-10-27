'use strict';
// Phase 5: authoritative corner duels and numeric Noggin-Off. No secrets in publicState.
const crypto = require('node:crypto');
const {enforceFamilyText}=require('../content-filter');
const BUZZER = require('../../data/buzzer-questions.json');
const BID = require('../../data/bid-categories.json');
const {acceptedAnswer} = require('../bid-answers');
// Q1: the Noggin-Off only ever uses real estimation questions, never sums or
// unit conversions that two finalists with a calculator would tie on exactly.
const CLOSE = require('../../data/close-call.json').filter(q => q.kind !== 'arithmetic');
// Q1: one replay at most. A tie on the replay goes to the closest, then the earliest answer.
const NOGGIN_OFF_MAX = 2;
const {SHOWDOWNS,SHOWDOWN_KINDS} = require('../layout');
const BID_REVIEW_MS = 12000;
// D7: after the first buzz, wait this long for other buzzes, then award the buzz to the
// fastest REACTION (measured on each phone from when the question appeared on it).
// Living-room game: trusting the phone's own timing is acceptable.
const BUZZ_WINDOW_MS = 150, MIN_BUZZ_MS = 100;
// G2: Buzzer Battle is first to 3 points, at most 5 questions (shorter, so the room isn't idle).
const BUZZER_TARGET = 3, BUZZER_QUESTIONS = 5;
const DURATION = {buzzer:84000,tug:50000,bid:75000,nerve:25000,tiebreak:25000};
function error(code,msg){const e=new Error(msg);e.code=code;throw e;}
function pick(items,rand=crypto.randomInt){return items[rand(items.length)];}
function normalize(s){return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'').trim();}
function player(room,id){return room.players.find(p=>p.id===id);}
function ms(room,normal,relaxed){return room.settings.timerSpeed==='relaxed'?relaxed:normal;}
function nextSum(m,id){const a=2+crypto.randomInt(24),b=2+crypto.randomInt(25),multiply=crypto.randomInt(3)===0;const n=m.sumSequence=(m.sumSequence||0)+1;m.sums[id]=multiply?{prompt:`${a} × ${2+(b%9)} = ?`,correct:a*(2+(b%9)),n}:{prompt:`${a+b+18} − ${b} = ?`,correct:a+18,n};}
function base(room,kind,title,participants,now){
 const b=room.board;migrate(b);
 const m={kind,title,participants,phase:'intro',startedAt:now,openAt:now+ms(room,4500,7500),deadline:now+ms(room,4500,7500),hardStop:now+DURATION[kind]+(room.settings.timerSpeed==='relaxed'?25000:0),roundKey:1,answered:[],history:[],result:null,cheers:{}};
 b.showdown=m;b.step='showdown';b.deadline=m.deadline;b.challenge=null;b.event={type:kind==='tiebreak'?'noggin-off':'showdown',text:kind==='tiebreak'?'NOGGIN-OFF! Nearest number wins.':`${title}: a head-to-head showdown!`};return m;
}
function migrate(b){if(!Array.isArray(b.tieQuestions))b.tieQuestions=[];}
function start(room,kind,now,opponentId=null,randomInt=crypto.randomInt){
 const b=room.board;let title,participants;
 if(kind==='tiebreak'){title='NOGGIN-OFF · CLOSE CALL';participants=b.finalists.slice();}
 else {title=SHOWDOWNS[b.landing];participants=[b.activeId,opponentId];if(!opponentId||opponentId===b.activeId||!player(room,opponentId))error('TARGET','Choose another player.');}
 const which=kind==='tiebreak'?'tiebreak':SHOWDOWN_KINDS[b.landing];
 if(!which)error('SPACE','This is not a showdown corner.');
 const m=base(room,which,title,participants,now);
 if(which==='buzzer'){m.points={};participants.forEach(id=>m.points[id]=0);m.questionIndex=0;m.totalRounds=BUZZER_QUESTIONS;m.used=[];m.phase='intro';}
 if(which==='tug'){m.rope=0;m.correctCount={};m.sums={};participants.forEach(id=>{m.correctCount[id]=0;nextSum(m,id);});}
 if(which==='bid'){m.category=pick(BID,randomInt);m.phase='intro';m.bid=0;m.bidderId=null;m.guesses=[];m.invalid=0;m.pendingReview=null;m.reviewCount=0;
   // G3: the rival (the player who did NOT land on the corner) bids first, so the
   // lander no longer gets to set the price and then always win the auction.
   m.turnId=participants[1];}
 if(which==='nerve'){m.bustAt=3+randomInt(8);m.banks={};m.number=1;}
 if(which==='tiebreak'){
   const available=CLOSE.filter(x=>!b.tieQuestions.includes(x.id));if(!available.length)b.tieQuestions=[];
   const pool=available.length?available:CLOSE;
   m.questionData=pick(pool,randomInt);b.tieQuestions.push(m.questionData.id);m.answers={};m.answerAt={};
   b.nogginOffRound=(b.nogginOffRound||0)+1;m.attempt=b.nogginOffRound;
   if(m.attempt>1)m.title='NOGGIN-OFF · REPLAY';
 }
 return m;
}
function open(room,now){const m=room.board.showdown;if(!m||m.phase!=='intro')return;
 if(m.kind==='buzzer'){nextBuzzer(room,now);return;}
 m.phase=({tug:'play',bid:'auction',nerve:'rising',tiebreak:'guess'})[m.kind];
 m.openAt=now;m.deadline=now+(m.kind==='bid'?ms(room,22000,31000):m.kind==='tiebreak'?ms(room,15000,24000):m.hardStop-now);
 room.board.deadline=m.deadline;
}
// Buzzer Battle is a general-knowledge quiz. Quick-sum questions are only used if every
// general question has been seen; questions are not repeated within a match.
const BUZZER_GENERAL=BUZZER.filter(q=>q.topic!=='maths');
// Q6: each duel climbs easy → medium → hard. With 7 questions: 2 easy, 3 medium, 2 hard.
function buzzerLevel(index,total){return index<=Math.round(total*0.3)?'easy':index<=Math.round(total*0.7)?'medium':'hard';}
const LEVEL_FALLBACK={easy:['easy','medium','hard'],medium:['medium','easy','hard'],hard:['hard','medium','easy']};
// Q6: shuffle the four answers every time a question is asked, so the right answer
// is never more likely to be in one particular position.
function shuffled(q,rand=crypto.randomInt){
 const order=[0,1,2,3].slice(0,q.choices.length);
 for(let i=order.length-1;i>0;i--){const j=rand(i+1);[order[i],order[j]]=[order[j],order[i]];}
 return {...q,choices:order.map(i=>q.choices[i]),correct:order.indexOf(q.correct)};
}
function nextBuzzer(room,now){const m=room.board.showdown,seen=room.board.seenBuzzer||(room.board.seenBuzzer=[]);
 const level=buzzerLevel(m.questionIndex+1,m.totalRounds||7);
 const unseen=BUZZER_GENERAL.filter(q=>!m.used.includes(q.id)&&!seen.includes(q.id));
 const unused=BUZZER_GENERAL.filter(q=>!m.used.includes(q.id));
 let q=null;
 for(const pool of [unseen,unused]){
  for(const l of LEVEL_FALLBACK[level]){const at=pool.filter(x=>(x.difficulty||'easy')===l);if(at.length){q=pick(at);break;}}
  if(q)break;
 }
 if(!q)q=pick(BUZZER.filter(x=>!m.used.includes(x.id)));
 seen.push(q.id);if(seen.length>=BUZZER_GENERAL.length)room.board.seenBuzzer=[];
 m.used.push(q.id);m.question=shuffled(q);m.questionAt=now;m.buzzes={};m.buzzWindowUntil=null;m.buzzReactions=null;m.phase='buzz';m.buzzId=null;m.passId=null;m.questionIndex++;m.answered=[];m.roundKey++;m.deadline=Math.min(m.hardStop,now+ms(room,6000,8000));room.board.deadline=m.deadline;
}
function allIds(m,arr){return m.participants.every(id=>Object.hasOwn(arr,id));}
function resolve(room,now,winners,message,finishTurn){const b=room.board,m=b.showdown;const unique=[...new Set(winners)].filter(id=>m.participants.includes(id));
 // Locked early audience predictions. Showtime: a capped Director Cue.
 // G2 Classic: +1 Spark, but only for players outside the current top two (catch-up).
 const predictors=[],catchUp=[];
 if(m.kind!=='tiebreak' && unique.length===1){
   for(const [id,pick] of Object.entries(m.cheers||{})){
     const spectator=player(room,id);
     if(!spectator || m.participants.includes(id) || pick!==unique[0])continue;
     if(room.settings.rules==='showtime'){if((spectator.cues||0)<2){spectator.cues=(spectator.cues||0)+1;predictors.push(spectator.name);}}
     else if(room.players.filter(p=>p.sparks>spectator.sparks).length>=2){spectator.sparks+=1;catchUp.push(spectator.name);}
   }
 }
 if(predictors.length)message+=` Spotlight Picks: ${predictors.join(', ')} earn${predictors.length===1?'s':''} a Director Cue for predicting the winner.`;
 if(catchUp.length)message+=` Spotlight Picks: ${catchUp.join(', ')} +1 Spark for backing the winner.`;
 b.showdown=null;b.deadline=null;
 if(m.kind==='tiebreak'){
   if(unique.length===1){b.winnerIds=unique;b.finalists=unique;room.phase='finished';b.step='finished';b.nextAt=null;b.result={text:message,winners:unique};b.event={type:'finished',text:message};return;}
   b.finalists=unique.length?unique:m.participants;start(room,'tiebreak',now);b.event={type:'noggin-off',text:'Still tied! One replay — closest wins, and if it is still level, the first answer in wins.'};return;
 }
 if(unique.length===1){const winner=player(room,unique[0]);const loser=player(room,m.participants.find(id=>id!==unique[0]));const stolen=Math.min(2,loser.sparks);loser.sparks-=stolen;winner.sparks+=stolen;message+=` ${winner.name} takes ${stolen} Spark${stolen===1?'':'s'} from ${loser.name}.`;
 }else message+=' Draw: nobody loses Sparks.';
 finishTurn(room,now,message,unique);
}
function finishBuzzer(room,now,finishTurn){const m=room.board.showdown;const a=m.participants;const x=m.points[a[0]],y=m.points[a[1]];const winners=x===y?[]:[x>y?a[0]:a[1]];resolve(room,now,winners,`Buzzer Battle ended ${x}–${y}.`,finishTurn);}
function finishTug(room,now,finishTurn){const m=room.board.showdown;const winners=m.rope===0?[]:[m.participants[m.rope>0?0:1]];resolve(room,now,winners,`Tug of Wits: rope moved ${Math.abs(m.rope)} notch${Math.abs(m.rope)===1?'':'es'}.`,finishTurn);}
function finishNerve(room,now,finishTurn){const m=room.board.showdown;const scores=m.participants.map(id=>({id,amount:m.banks[id]||0}));const best=Math.max(...scores.map(x=>x.amount));const winners=best>0?scores.filter(s=>s.amount===best).map(s=>s.id):[];resolve(room,now,winners,`Nerve: hidden bust was ${m.bustAt}. ${best>0?'Best safe bank: '+best+'.':'Nobody banked safely.'}`,finishTurn);}
function settleBuzz(room,now){const b=room.board,m=b.showdown;if(!m||m.phase!=='buzz'||!m.buzzes)return;
 const order=Object.entries(m.buzzes).sort((x,y)=>x[1].reactionMs-y[1].reactionMs||x[1].at-y[1].at);
 if(!order.length)return;
 m.buzzId=order[0][0];m.buzzReactions=order.map(([id,v])=>({id,reactionMs:v.reactionMs}));m.buzzWindowUntil=null;
 m.phase='answer';m.deadline=Math.min(m.hardStop,now+ms(room,5500,7500));b.deadline=m.deadline;
}
function endBuzzerQuestion(room,now,finishTurn){const m=room.board.showdown;if(Object.values(m.points).some(x=>x>=BUZZER_TARGET)||m.questionIndex>=BUZZER_QUESTIONS||now>=m.hardStop){finishBuzzer(room,now,finishTurn);}else nextBuzzer(room,now);}
function cheer(room,id,targetId){
 const m=room.board.showdown;
 if(!m||room.board.step!=='showdown'||m.kind==='tiebreak')error('STEP','There is no corner Showdown to predict.');
 if(m.phase!=='intro')error('LATE','Spotlight Picks close when the duel begins.');
 if(!room.players.some(p=>p.id===id))error('AUTH','Only contestants in the room can cheer.');
 if(m.participants.includes(id))error('ROLE','Challengers must play, not cheer for themselves.');
 if(!m.participants.includes(targetId))error('TARGET','Choose one of the two challengers.');
 if(Object.hasOwn(m.cheers,id))error('VOTED','Your cheer is already locked in.');
 m.cheers[id]=targetId;
}
function submit(room,id,value,roundKey,now,finishTurn){const b=room.board,m=b.showdown;
 if(!m||b.step!=='showdown')error('STEP','No Showdown in progress.');
 if(!m.participants.includes(id))error('PLAYER','This round is not for you.');
 if(m.phase==='intro')error('WAIT','Watch the game introduction.');
 if(roundKey!==m.roundKey)error('STALE','The question has moved on.');
 if(now>m.deadline||now>m.hardStop)error('LATE','Time is up.');
 if(m.kind==='buzzer'){
   if(m.phase==='buzz'){
     const tap=value==='buzz'?{}:(value&&typeof value==='object'&&value.action==='buzz'?value:null);
     if(!tap)error('INPUT','Press the buzzer.');
     m.buzzes??={};
     if(Object.hasOwn(m.buzzes,id))error('ANSWERED','You have already buzzed.');
     const windowMs=m.deadline-m.questionAt,claimed=Number(tap.reactionMs);
     const reactionMs=Number.isFinite(claimed)&&claimed>=MIN_BUZZ_MS&&claimed<=windowMs?Math.round(claimed):Math.max(MIN_BUZZ_MS,now-m.questionAt);
     m.buzzes[id]={reactionMs,at:now};
     if(!m.buzzWindowUntil)m.buzzWindowUntil=now+BUZZ_WINDOW_MS;
     if(allIds(m,m.buzzes))settleBuzz(room,now);
     return;
   }
   if(m.phase==='answer' && id===m.buzzId || m.phase==='pass'&&id===m.passId){
     if(!Number.isInteger(value)||value<0||value>=m.question.choices.length)error('INPUT','Choose an answer.');
     if(value===m.question.correct){m.points[id]++;m.history.push({round:m.questionIndex,winner:id});endBuzzerQuestion(room,now,finishTurn);}
     else if(m.phase==='answer'){
       m.phase='pass';m.passId=m.participants.find(x=>x!==id);m.deadline=Math.min(m.hardStop,now+ms(room,5000,7000));b.deadline=m.deadline;
     }else endBuzzerQuestion(room,now,finishTurn);
     return;
   }
   error('TURN','Wait for your buzzer or answer turn.');
 }
 if(m.kind==='tug'){
   if(m.phase!=='play')error('WAIT','Not ready.');
   const sum=m.sums[id];if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isSafeInteger(value.answer)||value.qid!==sum.n)error('INPUT','Submit the current sum as a whole number.');
   if(value.answer===sum.correct){m.rope+=id===m.participants[0]?1:-1;m.correctCount[id]++;}
   nextSum(m,id); // qid changes per player; a shared round key would race the other player
   if(Math.abs(m.rope)>=5)finishTug(room,now,finishTurn);return;
 }
 if(m.kind==='bid'){
   if(m.phase==='auction'){
     if(id!==m.turnId)error('TURN','Other bidder is deciding.');
     if(!value||typeof value!=='object'||Array.isArray(value))error('INPUT','Make a bid or challenge.');
     if(value.action==='challenge'){
       if(!m.bidderId)error('BID','Someone must bid first.');
       m.phase='name';m.deadline=Math.min(m.hardStop,now+ms(room,30000,42000));b.deadline=m.deadline;m.roundKey++;return;
     }
     if(value.action!=='bid'||!Number.isInteger(value.count)||value.count<=m.bid||value.count>m.category.answers.length)error('BID','Bid higher, up to the complete category size.');
     m.bid=value.count;m.bidderId=id;m.turnId=m.participants.find(x=>x!==id);m.roundKey++;m.deadline=Math.min(m.hardStop,now+ms(room,13000,19000));b.deadline=m.deadline;return;
   }
   if(m.phase==='review')error('WAIT','Your answer is being judged by the TV or another player.');
   if(m.phase!=='name'||id!==m.bidderId)error('TURN','Only the highest bidder can name answers.');
   if(typeof value!=='string'||value.length>70)error('INPUT','Enter an item name.');
   const answer=normalize(enforceFamilyText(room,value));if(answer.length<1||m.guesses.includes(answer))error('INPUT','Type a new answer.');
   const matchIndex=acceptedAnswer(m.category,answer);
   const allowed=matchIndex>=0 && !(m.usedBidAnswers||[]).includes(matchIndex);
   if(allowed)(m.usedBidAnswers|| (m.usedBidAnswers=[])).push(matchIndex);
   if(allowed){m.guesses.push(answer);if(m.guesses.length>=m.bid){resolve(room,now,[id],`Bid to Win: delivered ${m.bid} correct names!`,finishTurn);return;}}
   // Q7/D10: every unlisted answer is judged by the TV or a non-duelling player.
   else if (matchIndex < 0) {
     m.reviewCount++;m.pendingReview={answer,text:String(value).trim().slice(0,70),submittedBy:id,submittedAt:now};
     m.phase='review';m.deadline=Math.min(m.hardStop,now+BID_REVIEW_MS);b.deadline=m.deadline;
     m.roundKey++;return;
   } else {m.invalid++;if(m.invalid>=3){resolve(room,now,[m.participants.find(x=>x!==id)],'Bid to Win: three invalid answers; challenger wins.',finishTurn);return;}}
   m.roundKey++;return;
 }
 if(m.kind==='nerve'){
   if(m.phase!=='rising'||value!=='bank')error('INPUT','Tap BANK before the bust!');
   if(Object.hasOwn(m.banks,id))error('BANK','You already banked.');
   const number=Math.min(10,1+Math.floor((now-m.openAt)/1700));
   if(number>=m.bustAt){m.banks[id]=0;} else m.banks[id]=number;
   if(allIds(m,m.banks))finishNerve(room,now,finishTurn);return;
 }
 if(m.kind==='tiebreak'){
   if(m.phase!=='guess'||Object.hasOwn(m.answers,id))error('ANSWERED','You already answered.');
   if(!Number.isSafeInteger(value)||value<0||value>100000000)error('INPUT','Enter a whole number.');
   m.answers[id]=value;m.answerAt[id]=now;
   if(allIds(m,m.answers))finishTiebreak(room,now,finishTurn);return;
 }
 error('INPUT','Invalid game action.');
}
function finishTiebreak(room,now,finishTurn){
 const m=room.board.showdown,values=Object.entries(m.answers),final=(m.attempt||1)>=NOGGIN_OFF_MAX;
 const correct=m.questionData.answer,unit=m.questionData.unit||'';
 if(!values.length){
   if(!final){resolve(room,now,[],'Nobody answered; one more Noggin-Off question.',finishTurn);return;}
   // Nobody answered the replay either: the studio draws a finalist so the show ends.
   const drawn=pick(m.participants);
   resolve(room,now,[drawn],`Nobody answered the replay, so the studio drew a name: ${player(room,drawn).name} wins NOGGIN!`,finishTurn);return;
 }
 const best=Math.min(...values.map(([,v])=>Math.abs(v-correct)));
 const closest=values.filter(([,v])=>Math.abs(v-correct)===best).map(([id])=>id);
 if(closest.length===1){resolve(room,now,closest,`Noggin-Off: answer ${correct} ${unit}. ${player(room,closest[0]).name} wins NOGGIN!`,finishTurn);return;}
 if(!final){resolve(room,now,closest,`Noggin-Off: answer ${correct} ${unit}. Still tied — one replay!`,finishTurn);return;}
 // Q1: second tie in a row — the earliest of the closest answers wins. No third question.
 const first=[...closest].sort((a,z)=>(m.answerAt[a]??Infinity)-(m.answerAt[z]??Infinity))[0];
 resolve(room,now,[first],`Noggin-Off replay: answer ${correct} ${unit}. Still level, so ${player(room,first).name} wins NOGGIN for answering first!`,finishTurn);
}
function tick(room,now,finishTurn){const m=room.board.showdown;if(!m||room.board.step!=='showdown')return false;
 if(m.phase==='intro' && now>=m.deadline){open(room,now);return true;}
 if(m.kind==='nerve'&&m.phase==='rising'){
   const v=Math.min(10,1+Math.floor((now-m.openAt)/1700));if(v!==m.number){m.number=v;
     if(v>=m.bustAt){for(const id of m.participants)if(!Object.hasOwn(m.banks,id))m.banks[id]=0;finishNerve(room,now,finishTurn);}return true;
   }
 }
 if(m.kind==='buzzer'&&m.phase==='buzz'&&m.buzzWindowUntil&&now>=m.buzzWindowUntil){settleBuzz(room,now);return true;}
 if(now<m.deadline&&now<m.hardStop)return false;
 if(m.kind==='buzzer'){
   if(m.phase==='answer'){m.phase='pass';m.passId=m.participants.find(x=>x!==m.buzzId);m.deadline=Math.min(m.hardStop,now+ms(room,5000,7000));room.board.deadline=m.deadline;return true;}
   endBuzzerQuestion(room,now,finishTurn);return true;
 }
 if(m.kind==='tug'){finishTug(room,now,finishTurn);return true;}
 if(m.kind==='bid'){
   if(m.phase==='review'){decideBid(room,false,now,finishTurn);return true;}
   if(m.phase==='auction'&&m.bidderId){m.phase='name';m.deadline=Math.min(m.hardStop,now+ms(room,30000,42000));room.board.deadline=m.deadline;m.roundKey++;return true;}
   const winners=m.bidderId?[m.participants.find(x=>x!==m.bidderId)]:[];
   resolve(room,now,winners,m.bidderId?'Bid to Win: bidder ran out of time.':'Bid to Win: nobody bid.',finishTurn);return true;
 }
 if(m.kind==='nerve'){for(const id of m.participants)if(!Object.hasOwn(m.banks,id))m.banks[id]=0;finishNerve(room,now,finishTurn);return true;}
 if(m.kind==='tiebreak'){finishTiebreak(room,now,finishTurn);return true;}
 return false;
}
function publicState(room,forTv=false,viewerId=null){const m=room.board.showdown;if(!m)return null;
 const pub={kind:m.kind,title:m.title,phase:m.phase,participants:m.participants,openAt:m.openAt,deadline:m.deadline,hardStop:m.hardStop,roundKey:m.roundKey,answered:m.answered||[],question:'',display:{},private:null};
 if(m.kind!=='tiebreak'){
  pub.cheerOpen=m.kind!=='tiebreak'&&m.phase==='intro';
  pub.cheerCounts=Object.fromEntries(m.participants.map(id=>[id,Object.values(m.cheers||{}).filter(v=>v===id).length]));
  if(viewerId&&Object.hasOwn(m.cheers||{},viewerId))pub.myCheer=m.cheers[viewerId];
 }
 const reveal= m.phase!=='intro';
 if(m.kind==='buzzer'){pub.round=m.questionIndex;pub.totalRounds=BUZZER_QUESTIONS;pub.question=reveal?m.question?.question||'':'Buzz first, then choose the correct answer.';
   pub.display={choices:reveal?m.question?.choices:[],points:m.points,buzzId:m.buzzId,passId:m.passId,canBuzz:m.phase==='buzz',answerId:m.phase==='answer'?m.buzzId:m.phase==='pass'?m.passId:null,buzzed:Object.keys(m.buzzes||{}),buzzReactions:m.phase==='buzz'?null:m.buzzReactions||null};
 }
 if(m.kind==='tug'){pub.question='Answer the maths problems on your phone to pull the rope five notches.';pub.display={rope:m.rope,correctCount:m.correctCount};if(viewerId&&m.participants.includes(viewerId))pub.private={prompt:m.sums[viewerId].prompt,qid:m.sums[viewerId].n};}
 if(m.kind==='bid'){pub.question=reveal?m.category.prompt:'Bid how many category items you can name.';pub.display={bid:m.bid,bidderId:m.bidderId,turnId:m.turnId,correct:m.guesses.length,max:m.category.answers.length,invalid:m.invalid};
  if(m.phase==='review')pub.display.review={answer:m.pendingReview.answer,text:m.pendingReview.text||m.pendingReview.answer,submittedBy:m.pendingReview.submittedBy,deadline:m.deadline};}
 if(m.kind==='nerve'){pub.question='Bank before the unseen bust point. Highest safe bank wins.';pub.display={number:m.number,banks:Object.keys(m.banks)};}
 if(m.kind==='tiebreak'){pub.question=reveal?m.questionData.question:'Nearest guess wins NOGGIN!';pub.display={unit:m.questionData.unit,answered:Object.keys(m.answers),attempt:m.attempt||1,maxAttempts:NOGGIN_OFF_MAX};}
 return pub;
}
function decideBid(room,accept,now,finishTurn){
 const b=room.board,m=b.showdown;
 // D10: the first decision wins; anyone pressing a moment later is told it is done.
 if(!m||m.kind!=='bid'||m.phase!=='review'||!m.pendingReview)error('STEP','That answer has already been judged.');
 if(typeof accept!=='boolean')error('INPUT','Choose accept or reject.');
 if(now>m.deadline||now>m.hardStop)accept=false;
 const {answer,submittedBy}=m.pendingReview;
 m.pendingReview=null;m.phase='name';
 if(accept){
  if(m.guesses.includes(answer))error('DUPLICATE','This answer was already accepted.');
  m.guesses.push(answer);
  if(m.guesses.length>=m.bid){resolve(room,now,[submittedBy],`Bid to Win: delivered ${m.bid} correct names!`,finishTurn);return;}
 }else{
  m.invalid++;
  if(m.invalid>=3){resolve(room,now,[m.participants.find(id=>id!==submittedBy)],'Bid to Win: three invalid answers; challenger wins.',finishTurn);return;}
 }
 m.roundKey++;m.deadline=Math.min(m.hardStop,now+ms(room,14000,19000));b.deadline=m.deadline;
}
module.exports={BUZZER_TARGET,BUZZER_QUESTIONS,BUZZ_WINDOW_MS,settleBuzz,start,submit,cheer,tick,publicState,decideBid,normalize,DURATION,buzzerLevel,shuffled};
