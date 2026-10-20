'use strict';
// Phase 2: fully server-owned board, dice, special spaces and demo challenge.
const crypto = require('node:crypto');
const SPACES = Object.freeze([
 'start','create','brain','swap','create','together','speed','showdown',
 'brain','speed','brain','lift','create','together','brain','showdown',
 'speed','together','brain','wildcard','speed','create','showdown',
 'together','create','speed','lift','together','brain','drain','showdown',
 'speed','together','swap','create','pickpocket'
]);
const COLORS = {speed:'#ff667e',brain:'#64aeff',create:'#ffe477',together:'#9de97c',showdown:'#ffd168',start:'#fff',swap:'#be95ff',pickpocket:'#adb8cb',drain:'#98a1bc',wildcard:'#ff9ed9',lift:'#72f2ec'};
const ICONS = {speed:'⚡',brain:'◆',create:'✎',together:'✚',showdown:'★',start:'⌂',swap:'⇄',pickpocket:'◈',drain:'−',wildcard:'✳',lift:'⇧'};
const LABELS = {speed:'Speed',brain:'Brain',create:'Create',together:'Together',showdown:'Showdown',start:'Start',swap:'Swap Seats',pickpocket:'Pickpocket',drain:'Brain Drain',wildcard:'Wildcard',lift:'Stage Lift'};
const LIFTS = {11:26,26:11};
const SHOWDOWNS = {7:'Buzzer Battle',15:'Tug of Wits',22:'Bid to Win',30:'Nerve'};
const CATEGORIES = ['speed','brain','create','together'];
const DIRECTORS_CUES=2;
const DIRECTORS_CHOICE_MS=6000;
const DECISION_MS=12000;
const HEADLINE_WIN_BONUS=2;
const HEADLINE_LOSS_PENALTY=1;
const UNDERDOG_THRESHOLD=3;
const UNDERDOG_BONUS_SMALL=1;
const UNDERDOG_BONUS_EIGHT=2;
const QUESTIONS = require('../data/demo-questions.json');
const phase3 = require('./games/phase3');
const phase4 = require('./games/phase4');
const phase5 = require('./games/phase5');
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function requireStep(b,step){if(b.step!==step)fail('STEP','That action is not available right now.');}
function actor(room){return room.players.find(p=>p.id===room.board.activeId);}
function random(n,randomInt=crypto.randomInt){return randomInt(n);}
function showtime(room){return room.settings.rules==='showtime';}
function everyone(room){return room.settings.roundStyle==='everyone';}
const ROUND_ROLL_MS=12000;
const ROUND_MOVE_MS=900;
function publicBoard(room,forTv=false,viewerId=null) {
 const b=room.board;
 if (!b) return null;
 const challenge=b.challenge ? {kind:b.challenge.kind,title:b.challenge.title,question:b.challenge.question,choices:b.challenge.choices,participants:b.challenge.participants,answered:Object.keys(b.challenge.answers),deadline:b.challenge.deadline} : null;
 return {round:b.round ? {number:b.round.number,stage:b.round.stage,rolls:b.round.rolls,headlines:b.round.headlines,directors:b.round.directors,spotlightId:b.round.spotlightId,moveIndex:b.round.moveIndex,prioritySeat:b.round.prioritySeat} : null,routePlan:showtime(room)&&Boolean(b.routePlan),routeOptions:b.step==='choose_route'?(b.routeOptions||[]):[],headline:Boolean(b.headline),showdown:phase5.publicState(room,forTv,viewerId),minigame:(room.board?.minigame && phase4.SPECS[room.board.minigame.id] ? phase4.publicState(room,forTv,viewerId): phase3.publicState(room,forTv)),step:b.step,turn:b.turn,activeId:b.activeId,rolls:b.rolls,landing:b.landing,lastMove:b.lastMove,event:b.event,deadline:b.deadline,nextAt:b.nextAt,challenge,result:b.result,leaderIds:b.leaderIds,finalists:b.finalists,winnerIds:b.winnerIds,history:b.history.slice(-8),paused:Boolean(b.pausedAt),pauseReason:b.pauseReason};
}
function start(room,now=Date.now()){
 if(room.phase!=='lobby')fail('PHASE','Game already started.');
 if(!room.hostSocketId || room.players.length<2 || !room.players.every(p=>p.ready && p.socketId))fail('READY','Two to eight connected, ready players required.');
 for(const p of room.players){p.sparks=0;p.position=0;p.cues=showtime(room)?DIRECTORS_CUES:0;}
 room.phase='board';room.board={step:'await_roll',turn:1,activeId:room.players[0].id,rolls:[],landing:0,lastMove:null,event:{type:'intro',text:'Welcome to the NOGGIN stage!'},deadline:null,nextAt:null,challenge:null,result:null,leaderIds:[],finalists:[],winnerIds:[],history:[],pausedAt:null,pauseReason:null,showdown:null,tieQuestions:[],seenQuestions:[],seenGames:[],lastGame:null,minigame:null,moveRevision:0,routePlan:false,routeOptions:[],headline:false,headlineEligible:false,turnStartSparks:Object.fromEntries(room.players.map(p=>[p.id,p.sparks]))};
 if(everyone(room)) beginRound(room,now);
}
// Everyone Rolls is kept separate from the original sequential turn engine.
// The server creates every die, including timeout rolls; clients cannot specify values.
function beginRound(room,now){
 const b=room.board,number=(b.round?.number||0)+1;
 const seats=[...room.players].sort((a,z)=>a.seat-z.seat);
 const spotlight=seats[(number-1)%seats.length];
 b.round={number,stage:'rolling',rolls:{},moves:[],moveIndex:0,
   spotlightId:spotlight.id,prioritySeat:seats[(number-1)%seats.length].seat,headlines:{},directors:{},
   pendingMini:false,showdownId:null,showdownDone:false};
 b.turn=number;b.activeId=spotlight.id;b.step='round_roll';b.rolls=[];
 b.deadline=now+ROUND_ROLL_MS;b.nextAt=null;b.result=null;
 b.event={type:'round',text:`Round ${number}: everyone roll now!`};
 b.turnStartSparks=Object.fromEntries(room.players.map(p=>[p.id,p.sparks]));
}
function roundRoll(room,id,now,rng=crypto.randomInt){
 const b=room.board,r=b.round;if(!everyone(room)||!r||r.stage!=='rolling')fail('STEP','Not time to roll.');
 if(!room.players.some(p=>p.id===id))fail('PLAYER','Not in this room.');
 if(Object.hasOwn(r.rolls,id))fail('ROLLED','Your roll is already locked in.');
 const p=room.players.find(p=>p.id===id),lowest=Math.min(...room.players.map(x=>x.sparks));
 const catchUp=showtime(room)&&p.sparks===lowest&&room.players.some(x=>x.sparks>lowest);
 const dice=Array.from({length:catchUp?2:1},()=>1+random(6,rng));
 // On a shared countdown, the server picks the higher catch-up die automatically.
 let die=Math.max(...dice);
 if(r.directors[id] && p.cues>0){
   const scores={showdown:5,wildcard:4,brain:3,speed:3,create:3,together:3,start:5,pickpocket:4,drain:-5};
   const options=[die,Math.max(1,die-1),Math.min(6,die+1)].filter((x,i,a)=>a.indexOf(x)===i);
   const choice=options.sort((a,z)=>(scores[SPACES[(p.position+z)%36]]||0)-(scores[SPACES[(p.position+a)%36]]||0))[0];
   if(choice!==die){die=choice;p.cues--; }
 }
 r.rolls[id]={dice,die,automatic:false};
 if(room.players.every(x=>Object.hasOwn(r.rolls,x.id)))prepareRoundMoves(room,now,rng);
}
function prepareRoundMoves(room,now,rng=crypto.randomInt){
 const b=room.board,r=b.round;if(r.stage!=='rolling')return;
 for(const p of room.players){if(!Object.hasOwn(r.rolls,p.id)){
   const lowest=Math.min(...room.players.map(x=>x.sparks));
   const catchUp=showtime(room)&&p.sparks===lowest&&room.players.some(x=>x.sparks>lowest);
   const dice=Array.from({length:catchUp?2:1},()=>1+random(6,rng));
   r.rolls[p.id]={dice,die:Math.max(...dice),automatic:true};
 }}
 r.moves=[...room.players].sort((a,z)=>a.seat-z.seat).map(p=>({id:p.id,die:r.rolls[p.id].die}));
 r.stage='moving';r.moveIndex=0;b.step='round_moving';b.deadline=null;b.nextAt=now+ROUND_MOVE_MS;
 b.event={type:'round',text:'Dice locked! Watch everyone move.'};
}
function advanceRoundMove(room,now){
 const b=room.board,r=b.round,entry=r.moves[r.moveIndex];
 if(!entry){resolveRoundLandings(room,now);return;}
 const p=room.players.find(x=>x.id===entry.id),from=p.position,path=[];
 for(let k=1;k<=entry.die;k++)path.push((from+k)%SPACES.length);
 p.position=path.at(-1);const to=p.position;
 if(path.includes(0)&&to!==0){p.sparks++;if(showtime(room))p.cues=Math.min(DIRECTORS_CUES,(p.cues||0)+1);}
 b.activeId=p.id;b.landing=to;
 b.lastMove={playerId:p.id,from,to,path,die:entry.die,revision:++b.moveRevision};
 b.event={type:'move',text:`Moving: ${p.name} (${entry.die})`};
 r.moveIndex++;b.nextAt=now+ROUND_MOVE_MS;
}
function resolveRoundLandings(room,now){
 const b=room.board,r=b.round,seats=[...room.players].sort((a,z)=>a.seat-z.seat);
 const landings=seats.map(p=>({p,type:SPACES[p.position],landing:p.position}));
 const contenders=landings.filter(x=>x.type==='showdown');
 const ordered=contenders.sort((a,z)=>((a.p.seat-r.prioritySeat+seats.length)%seats.length)-((z.p.seat-r.prioritySeat+seats.length)%seats.length));
 const chosen=ordered[0];
 for(const {p,type} of landings){
   if(type==='start')p.sparks+=2;
   else if(type==='lift')p.position=LIFTS[p.position];
   else if(type==='pickpocket'){
     const victim=room.players.filter(x=>x.id!==p.id).sort((a,z)=>z.sparks-a.sparks||a.seat-z.seat)[0];
     if(victim?.sparks>0){victim.sparks--;p.sparks++;}
   }else if(type==='swap'){
     const other=room.players.find(x=>x.id!==p.id);
     if(other)[p.position,other.position]=[other.position,p.position];
   }else if(type==='showdown'&&p.id!==chosen?.p.id)p.sparks++;
   else if(type==='drain')p.sparks=Math.max(0,p.sparks-1);
 }
 r.stage='contest';r.pendingMini=true;
 const spotlight=room.players.find(p=>p.id===r.spotlightId),type=landings.find(x=>x.p.id===spotlight.id).type;
 r.category=CATEGORIES.includes(type)?type:'brain';
 b.activeId=spotlight.id;b.landing=spotlight.position;
 if(chosen){
   const rival=room.players.filter(p=>p.id!==chosen.p.id).sort((a,z)=>z.sparks-a.sparks||a.seat-z.seat)[0];
   b.activeId=chosen.p.id;b.landing=chosen.landing;r.showdownId=chosen.p.id;
   phase5.start(room,'corner',now,rival.id);return;
 }
 startRoundMini(room,now);
}
function startRoundMini(room,now){
 const b=room.board,r=b.round;r.stage='minigame';r.pendingMini=false;
 b.activeId=r.spotlightId;
 const category=r.category;
 (category==='speed'||category==='brain'?phase3:phase4).start(room,category,now);
}
function tickRound(room,now,rng){
 const b=room.board,r=b.round;
 if(r.stage==='rolling'&&now>=b.deadline){prepareRoundMoves(room,now,rng);return true;}
 if(r.stage==='moving'&&now>=b.nextAt){advanceRoundMove(room,now);return true;}
 return false;
}
function currentIs(room,id){if(room.board.activeId!==id)fail('TURN','It is not your turn.');}
function beginMove(room,die,now,rng=crypto.randomInt){
 const b=room.board,p=actor(room),from=p.position,path=[];
 for(let k=1;k<=die;k++)path.push((from+k)%36);
 const to=path.at(-1);
 p.position=to;b.landing=to;b.lastMove={playerId:p.id,from,to,path,die,revision:++b.moveRevision};b.rolls=[];
 const crossed=path.includes(0);
 if(crossed && to!==0) p.sparks+=1;
 // Completing a lap refreshes a single Director Cue, capped at two.
 if(crossed && showtime(room)) p.cues=Math.min(DIRECTORS_CUES,(p.cues||0)+1);
 resolveLanding(room,now,crossed&&to!==0,rng);
}
function roll(room,id,now,randomInt){
 const b=room.board;if(everyone(room)){roundRoll(room,id,now,randomInt);return;}requireStep(b,'await_roll');currentIs(room,id);
 const low=Math.min(...room.players.map(p=>p.sparks));
 const diceCount=showtime(room)&&actor(room).sparks===low && room.players.some(p=>p.sparks>low) ? 2 : 1;
 b.rolls=Array.from({length:diceCount},()=>1+random(6,randomInt));
 if(showtime(room)&&b.routePlan){
   const p=actor(room);const options=[];
   for(let i=0;i<b.rolls.length;i++)for(const offset of [0,-1,1]){
     const steps=b.rolls[i]+offset;
     if(steps<1||steps>6||(offset!==0&&p.cues<1))continue;
     const landing=(p.position+steps)%SPACES.length;
     if(!options.some(o=>o.steps===steps))options.push({dieIndex:i,offset,steps,landing,type:SPACES[landing],cost:offset===0?0:1});
   }
   b.routeOptions=options;b.step='choose_route';b.deadline=now+DIRECTORS_CHOICE_MS;
   b.event={type:'directors-cut',text:`${p.name} calls DIRECTOR'S CUT! Choose a landing. Nudging one space costs a Cue.`};return;
 }
 if(diceCount===2){b.step='choose_die';b.deadline=now+DECISION_MS;b.event={type:'dice',text:'Catch-up roll: choose either die.'};return;}
 beginMove(room,b.rolls[0],now,randomInt);
}
function pickDie(room,id,index,now,rng=crypto.randomInt){const b=room.board;requireStep(b,'choose_die');currentIs(room,id);if(index!==0&&index!==1)fail('DIE','Choose die 1 or die 2.');beginMove(room,b.rolls[index],now,rng);}
function sampleQuestion(b,randomInt){
 const pool=QUESTIONS.filter(q=>!b.seenQuestions.includes(q.id));
 const options=pool.length?pool:QUESTIONS;
 const chosen=options[random(options.length,randomInt)];
 b.seenQuestions.push(chosen.id);if(b.seenQuestions.length>=QUESTIONS.length)b.seenQuestions=[];
 return chosen;
}
function beginChallenge(room,kind,now,randomInt=crypto.randomInt,opponentId){
 const b=room.board,q=sampleQuestion(b,randomInt);
 let participants=[];
 if(kind==='showdown')participants=[b.activeId,opponentId];
 else if(kind==='drain')participants=[b.activeId];
 else if(kind==='tiebreak')participants=b.finalists.slice();
 else participants=room.players.map(p=>p.id);
 const ms=kind==='drain'?5_000:(room.settings.timerSpeed==='relaxed'?24_000:16_000);
 b.challenge={kind,title:kind==='showdown'?'CORNER SHOWDOWN · Phase 2 Challenge':kind==='drain'?'BRAIN DRAIN':kind==='tiebreak'?'NOGGIN-OFF TIEBREAKER':'QUICK CHOICE · Phase 2 Demo',question:q.prompt,choices:q.options,correct:q.correct,participants,answers:{},deadline:now+ms};
 b.step='challenge';b.deadline=b.challenge.deadline;
 b.event={type:'challenge',text:kind==='drain'?'Answer in five seconds or lose one Spark.':kind==='showdown'?'Head to head! The winner steals up to two Sparks.':kind==='tiebreak'?'Closest to the tie-break target wins.':'All contestants: choose the correct answer on your phone.'};
}
function resolveLanding(room,now,passed,rng=crypto.randomInt){
 const b=room.board,p=actor(room),type=SPACES[p.position];b.result=null;b.deadline=null;
 b.headlineEligible=CATEGORIES.includes(type)||type==='showdown';
 if(type==='start') {p.sparks+=2;finishTurn(room,now,`${p.name} landed on START: +2 Sparks!`);return;}
 if(type==='lift') {const was=p.position;p.position=LIFTS[was];finishTurn(room,now,`${p.name} rode the Stage Lift to space ${p.position+1}!${passed?' +1 Spark for passing START.':''}`);return;}
 if(type==='pickpocket'){
   const candidates=room.players.filter(x=>x.id!==p.id).sort((a,z)=>z.sparks-a.sparks||a.seat-z.seat),victim=candidates[0];
   if(victim?.sparks>0){victim.sparks--;p.sparks++;finishTurn(room,now,`${p.name} stole one Spark from ${victim.name}!`);}else finishTurn(room,now,'No Sparks to steal!');return;
 }
 if(type==='swap'){b.step='choose_target';b.deadline=now+DECISION_MS;b.event={type:'swap',text:`${p.name}: choose a player to swap board positions with.`};return;}
 if(type==='wildcard'){b.step='choose_category';b.deadline=now+DECISION_MS;b.event={type:'wildcard',text:`${p.name}: pick your demo challenge category.`};return;}
 if(type==='showdown'){b.step='choose_opponent';b.deadline=now+DECISION_MS;b.event={type:'showdown',text:`${SHOWDOWNS[p.position]} corner! ${p.name} challenges a rival.`};return;}
 if(type==='drain'){beginChallenge(room,'drain',now,rng);return;}
 if(CATEGORIES.includes(type)){(type==='speed'||type==='brain'?phase3:phase4).start(room,type,now,rng);return;}
 beginChallenge(room,'demo',now,rng);
 b.event={type:'challenge',category:type,text:`${LABELS[type]} space! Quick Choice demo challenge for all players.`};
}
function choose(room,id,payload,now,randomInt){
 const b=room.board;
 if(everyone(room) && b.step==='round_roll'){
   const r=b.round,p=room.players.find(x=>x.id===id);
   if(!p)fail('PLAYER','Not seated.');
   if(Object.hasOwn(r.rolls,id))fail('ROLLED','Your roll is already locked in.');
   if(!showtime(room))fail('RULES','Showtime features are disabled in Classic.');
   if(payload?.action==='headline'){if(p.sparks<1)fail('SPARKS','You need a Spark to place a bet.');r.headlines[id]=true;}
   else if(payload?.action==='safe')delete r.headlines[id];
   else if(payload?.action==='director'){if(!p.cues)fail('CUES','No Director Cues left.');r.directors[id]=true;}
   else if(payload?.action==='normal')delete r.directors[id];
   else fail('STEP','Unsupported shared-round action.');
   return;
 }
 currentIs(room,id);
 if(!showtime(room) && b.step==='await_roll' && ['headline','safe','director','normal'].includes(payload?.action))fail('RULES','Extra options are disabled in Classic.');
 if(b.step==='await_roll' && ['headline','safe'].includes(payload?.action)){
   if(payload.action==='headline' && actor(room).sparks<1)fail('SPARKS','You need at least one Spark to call a Headline Bet.');
   b.headline=payload.action==='headline';
   b.event={type:'headline',text:b.headline?`${actor(room).name} calls a HEADLINE BET: win the upcoming challenge for +2 bonus Sparks, or lose 1 extra Spark!`:`${actor(room).name} plays it safe.`};return;
 }
 if(b.step==='await_roll' && ['director','normal'].includes(payload?.action)){
   if(payload.action==='director' && !(actor(room).cues>0))fail('CUES','No Director Cues left.');
   b.routePlan=payload.action==='director';
   b.event={type:'directors-cut',text:b.routePlan?`${actor(room).name} is planning a Director's Cut — roll, then choose the landing.`:`${actor(room).name} will take the normal roll.`};return;
 }
 if(b.step==='choose_route'){
   if(!Number.isInteger(payload?.option)||!b.routeOptions[payload.option])fail('ROUTE','Choose one of the displayed landings.');
   const option=b.routeOptions[payload.option],p=actor(room);
   if(option.cost>p.cues)fail('CUES','Not enough Director Cues.');
   p.cues-=option.cost;b.routeOptions=[];b.routePlan=false;
   beginMove(room,option.steps,now,randomInt);return;
 }
 if(b.step==='choose_target'||b.step==='choose_opponent'){
   const target=room.players.find(p=>p.id===payload.targetId&&p.id!==id);
   if(!target)fail('TARGET','Choose another contestant.');
   if(b.step==='choose_target'){const p=actor(room);[p.position,target.position]=[target.position,p.position];finishTurn(room,now,`${p.name} swapped positions with ${target.name}!`);} 
   else phase5.start(room,'corner',now,target.id,randomInt);
   return;
 }
 if(b.step==='choose_category'){
   if(!CATEGORIES.includes(payload.category))fail('CATEGORY','Choose Speed, Brain, Create or Together.');
   if(CATEGORIES.includes(payload.category)){(payload.category==='speed'||payload.category==='brain'?phase3:phase4).start(room,payload.category,now,randomInt);return;}
   beginChallenge(room,'demo',now,randomInt);
   b.event={type:'challenge',category:payload.category,text:`Wildcard selected: ${LABELS[payload.category]}! Quick Choice Phase 2 placeholder.`};return;
 }
 fail('STEP','Nothing to choose right now.');
}
function answer(room,id,choice,now){
 const b=room.board;requireStep(b,'challenge');const c=b.challenge;
 if(!c.participants.includes(id))fail('PLAYER','You are not part of this challenge.');
 if(Object.hasOwn(c.answers,id))fail('ANSWERED','You already submitted an answer.');
 if(!Number.isInteger(choice)||choice<0||choice>=c.choices.length)fail('ANSWER','Select one of the displayed answers.');
 if(now>c.deadline)fail('LATE','Time is up.');
 c.answers[id]={choice,at:now,correct:choice===c.correct};
 if(c.participants.every(pid=>Object.hasOwn(c.answers,pid)))resolveChallenge(room,now);
}
function resolveChallenge(room,now){
 const b=room.board,c=b.challenge;
 if(!c||b.step!=='challenge')return;
 const correct=Object.entries(c.answers).filter(([,a])=>a.correct).sort((x,y)=>x[1].at-y[1].at);
 let winners=correct.length?[correct[0][0]]:[];
 if(c.kind==='tiebreak') {
   const scored=Object.entries(c.answers).map(([id,a])=>({id,distance:Math.abs(Number(c.choices[a.choice])-Number(c.choices[c.correct]))}));
   const best=Math.min(...scored.map(x=>x.distance));
   winners=scored.filter(x=>x.distance===best).map(x=>x.id);
 }
 let summary='Nobody found the answer.';
 if(c.kind==='drain'){
   const p=actor(room);
   if(!winners.length){p.sparks=Math.max(0,p.sparks-1);summary=`${p.name} missed Brain Drain and lost 1 Spark.`;}
   else summary=`${p.name} survived Brain Drain!`;
 } else if(c.kind==='showdown'){
   if(winners.length){const winner=room.players.find(p=>p.id===winners[0]),loser=room.players.find(p=>p.id===c.participants.find(id=>id!==winners[0]));const taken=Math.min(2,loser.sparks);loser.sparks-=taken;winner.sparks+=taken;summary=`${winner.name} won the Showdown and took ${taken} Spark${taken===1?'':'s'} from ${loser.name}.`;}
   else summary='Showdown draw! No Sparks change hands.';
 }else if(c.kind==='tiebreak'){
   if(winners.length===1){b.winnerIds=winners;b.step='finished';room.phase='finished';summary=`${room.players.find(p=>p.id===winners[0]).name} wins NOGGIN!`;}
   else{b.finalists=winners.length?winners:c.participants;b.challenge=null;beginChallenge(room,'tiebreak',now);b.result={text:'Still tied! Another Close Call!',winners:[]};return;}
 }else{
   for(const id of winners){const p=room.players.find(p=>p.id===id);p.sparks+=(id===b.activeId?2:1);}
   const host=actor(room);
   if(!winners.includes(host.id)){host.sparks=Math.max(0,host.sparks-1);}
   summary=winners.length?`${room.players.find(p=>p.id===winners[0]).name} was fastest with the correct answer: ${winners[0]===host.id?'+2':'+1'} Spark${winners[0]===host.id?'s':''}!${winners[0]!==host.id?' Host loses 1 for coming last.':''}`:`Nobody was correct. ${host.name} loses 1 Spark (minimum zero).`;
 }
 b.challenge=null;
 if(c.kind==='tiebreak' && room.phase==='finished'){
   b.deadline=null;b.result={text:summary,winners};b.event={type:'finished',text:summary};return;
 }
 finishTurn(room,now,summary,winners);
}
function finishTurn(room,now,text,winners=[]){
 const b=room.board;
 if(everyone(room)&&b.round?.stage==='minigame'&&showtime(room)){
   for(const [id,active] of Object.entries(b.round.headlines)){
     if(!active)continue;const p=room.players.find(x=>x.id===id);if(!p)continue;
     if(winners.includes(id)){p.sparks+=HEADLINE_WIN_BONUS;text+=` · ${p.name} wins their Headline Bet!`;}
     else{p.sparks=Math.max(0,p.sparks-HEADLINE_LOSS_PENALTY);text+=` · ${p.name} loses their Headline Bet.`;}
   }
 }
 // The underdog bonus is calculated against scores at the START of this turn,
 // not after other players earned their rewards. Only an actual game/showdown
 // winner can claim it; passive board spaces never pay a bonus.
 // The Headline Bet is an opt-in risk on contested spaces only.
 // Passive squares neither pay nor punish the wager.
 if(showtime(room) && b.headline && b.headlineEligible){
   const headliner=actor(room);
   if(winners.includes(headliner.id)){headliner.sparks+=HEADLINE_WIN_BONUS;text+=` · HEADLINE HIT: ${headliner.name} earns +${HEADLINE_WIN_BONUS} bonus Sparks!`;}
   else {headliner.sparks=Math.max(0,headliner.sparks-HEADLINE_LOSS_PENALTY);text+=` · HEADLINE FLOP: ${headliner.name} loses ${HEADLINE_LOSS_PENALTY} Spark.`;}
 }
 // Winning contests earns a new Director Cue. This works without completing a lap.
 const newCues=[];
 for(const id of showtime(room)?new Set(winners):[]){const winner=room.players.find(p=>p.id===id);if(winner && (winner.cues||0)<DIRECTORS_CUES){winner.cues=(winner.cues||0)+1;newCues.push(winner.name);}}
 if(newCues.length)text+=` · Director Cue earned: ${newCues.join(' & ')}.`;
 // Two-player comeback: a trailing contestant gains one extra Spark only
 // when winning a contested activity. The start-of-turn gap must be
 // at least 2 Sparks in sequential mode, or 4 in Everyone Rolls mode. No passive rewards or free wins.
 const twoPlayerSnapshot=b.turnStartSparks||{};
 const comebackIds=room.players.length===2
   ? [...new Set(winners)].filter(id=>Number.isInteger(twoPlayerSnapshot[id]) &&
       Math.max(...Object.values(twoPlayerSnapshot))-twoPlayerSnapshot[id]>=(everyone(room)?4:2))
   : [];
 for(const id of comebackIds){room.players.find(p=>p.id===id).sparks+=2;}
 if(comebackIds.length)text+=` · Comeback bonus: ${comebackIds.map(id=>room.players.find(p=>p.id===id).name).join(' & ')} +2 Sparks!`;
 const snapshot=b.turnStartSparks||{};
 const initialLeader=Math.max(0,...Object.values(snapshot));
 const underdogs=[...new Set(winners)].filter(id=>room.players.length>=4 && Number.isInteger(snapshot[id]) && initialLeader-snapshot[id]>=UNDERDOG_THRESHOLD);
 const bonus=room.players.length>=8?UNDERDOG_BONUS_EIGHT:UNDERDOG_BONUS_SMALL;
 for(const id of underdogs){const p=room.players.find(x=>x.id===id);if(p)p.sparks+=bonus;}
 if(underdogs.length)text+=` · Underdog boost: ${underdogs.map(id=>room.players.find(p=>p.id===id).name).join(' & ')} +${bonus} bonus Spark${bonus===1?'':'s'}!`;
 b.step='result';b.deadline=null;b.nextAt=now+(room.settings.timerSpeed==='relaxed'?4200:2900);b.result={text,winners,underdogs};b.event={type:'result',text};
 b.history.push({turn:b.turn,name:actor(room).name,text});if(b.history.length>60)b.history.shift();
 const max=Math.max(...room.players.map(p=>p.sparks));
 b.leaderIds=room.players.filter(p=>p.sparks===max).map(p=>p.id);
 const qualified=room.players.filter(p=>p.sparks>=room.settings.target);
 if(qualified.length>0)b.finalists=qualified.map(p=>p.id);
}
function nextTurn(room,now){
 const b=room.board;
 if(everyone(room)&&b.round?.pendingMini){startRoundMini(room,now);return;}
 if(everyone(room)&&b.round&&!b.round.pendingMini){
   const qualified=room.players.filter(p=>p.sparks>=room.settings.target);
   if(qualified.length===1 && b.round.number>=8){b.winnerIds=[qualified[0].id];b.step='finished';room.phase='finished';b.event={type:'finished',text:`${qualified[0].name} wins NOGGIN!`};b.nextAt=null;return;}
   if(qualified.length>1 && b.round.number>=8){b.finalists=qualified.map(p=>p.id);phase5.start(room,'tiebreak',now,null);return;}
   beginRound(room,now);return;
 }
 if(b.finalists.length===1){b.winnerIds=b.finalists.slice();b.step='finished';room.phase='finished';b.event={type:'finished',text:`${room.players.find(p=>p.id===b.winnerIds[0]).name} wins NOGGIN!`};b.nextAt=null;return;}
 if(b.finalists.length>1){phase5.start(room,'tiebreak',now,null);return;}
 const current=room.players.findIndex(p=>p.id===b.activeId);
 b.activeId=room.players[(current+1)%room.players.length].id;
 b.turn++;b.routePlan=false;b.routeOptions=[];b.headline=false;b.headlineEligible=false;b.turnStartSparks=Object.fromEntries(room.players.map(p=>[p.id,p.sparks]));b.step='await_roll';b.rolls=[];b.result=null;b.event={type:'turn',text:`${actor(room).name}'s turn: roll the die!`};b.deadline=null;b.nextAt=null;
}
function minigameInput(room,id,value,roundKey,now){if(room.board.step==='showdown')return phase5.submit(room,id,value,roundKey,now,finishTurn);return room.board.minigame&&phase4.SPECS[room.board.minigame.id]?phase4.submit(room,id,value,roundKey,now,finishTurn):phase3.submit(room,id,value,roundKey,now);}
function minigameDraw(room,id,points,roundKey,now){return phase4.draw(room,id,points,roundKey,now);}
// All live clocks are owned by the server. Pauses must shift BOTH deadlines and
// the visual cue timestamps supplied to phones and the TV, or a resumed round
// can reveal DRAW!, the target count, or the anagram clue at the wrong time.
function resumeClocks(room,now,{preserveGrace=false}={}){
 const b=room.board;
 if(!Number.isFinite(b?.pausedAt))return 0;
 const delta=Math.max(0,now-b.pausedAt);
 const move=(obj,key)=>{if(obj&&Number.isFinite(obj[key]))obj[key]+=delta;};
 for(const key of ['deadline','nextAt'])move(b,key);
 move(b.challenge,'deadline');
 for(const key of ['deadline','hardStop','openAt','startedAt'])move(b.showdown,key);
 for(const key of ['deadline','openAt','introUntil','stageStarted'])move(b.minigame,key);
 for(const key of ['readyAt','flashEndsAt','revealAt'])move(b.minigame?.display,key);
 if(preserveGrace)for(const p of room.players)move(p,'offlineSince');
 b.pausedAt=null;b.pauseKind=null;b.pauseReason=null;
 return delta;
}
function hostPause(room,now){
 const b=room.board;
 if(room.phase!=='board'||!b||b.step==='finished')fail('PHASE','No active game to pause.');
 if(Number.isFinite(b.pausedAt))fail('PAUSED','The game is already paused.');
 b.pausedAt=now;b.pauseKind='manual';b.pauseReason='The TV host has paused the show.';
 b.event={type:'pause',text:'SHOW PAUSED · The host will resume play.'};
}
function hostResume(room,now){
 const b=room.board;
 if(room.phase!=='board'||!b||b.pauseKind!=='manual')fail('PHASE','Only a host-paused show can be resumed manually.');
 resumeClocks(room,now,{preserveGrace:true});
 b.event={type:'resume',text:'BACK ON AIR · The show continues!'};
}
function forfeitDisconnected(room,now){
 const b=room.board,p=actor(room);
 // Clear unfinished private challenges. The host is not charged for a wager
 // on a game which was cancelled by a lost connection.
 b.challenge=null;b.minigame=null;b.showdown=null;b.deadline=null;
 b.headline=false;b.headlineEligible=false;
 finishTurn(room,now,`${p.name} disconnected. Their turn was skipped.`);
}
function skipDisconnected(room,now){
 const b=room.board;
 if(room.phase!=='board'||!b||['result','finished'].includes(b.step))fail('PHASE','There is no active turn to skip.');
 const p=actor(room);
 if(p?.socketId||!Number.isFinite(p?.offlineSince))fail('ONLINE','Only the disconnected active contestant can be skipped.');
 if(b.pauseKind==='manual')fail('PAUSED','Resume the show before skipping the disconnected player.');
 resumeClocks(room,now);
 forfeitDisconnected(room,now);
}
function tick(room,now,rng=crypto.randomInt){
 if(room.phase!=='board'||!room.board)return false;
 const b=room.board;
 if(!room.hostSocketId)return false;
 if(b.pauseKind==='manual')return false;
 if(everyone(room)&&b.round && ['rolling','moving'].includes(b.round.stage))return tickRound(room,now,rng);
 const p=actor(room);
 if(p&&!p.socketId && !['result','finished'].includes(b.step)){
   if(p.offlineSince!==null&&now-p.offlineSince>=30_000){
     resumeClocks(room,now);
     forfeitDisconnected(room,now);return true;
   }
   if(!Number.isFinite(b.pausedAt)){b.pausedAt=now;b.pauseKind='player';b.pauseReason='Waiting up to 30 seconds for the active player to reconnect.';return true;}
   return false;
 }
 if(Number.isFinite(b.pausedAt)){resumeClocks(room,now);return true;}
 if(b.step==='showdown')return phase5.tick(room,now,finishTurn);
 if(b.step==='minigame')return b.minigame&&phase4.SPECS[b.minigame.id]?phase4.tick(room,now,finishTurn,rng):phase3.tick(room,now,finishTurn,rng);
 if(b.step==='challenge'&&now>=b.challenge.deadline){resolveChallenge(room,now);return true;}
 if(b.step==='result'&&now>=b.nextAt){nextTurn(room,now);return true;}
 if(b.deadline&&now>=b.deadline){
   if(b.step==='choose_die'){beginMove(room,b.rolls[0],now,rng);return true;}
   if(b.step==='choose_route'){const i=b.routeOptions.findIndex(o=>o.cost===0);choose(room,b.activeId,{option:i<0?0:i},now,rng);return true;}
   if(b.step==='choose_category'){phase4.start(room,'create',now,rng);return true;}
   if(b.step==='choose_target'||b.step==='choose_opponent'){
     const t=room.players.find(x=>x.id!==b.activeId);
     if(!t){finishTurn(room,now,'No opponent available.');return true;}
     choose(room,b.activeId,{targetId:t.id},now,rng);return true;
   }
 }
 return false;
}
module.exports={beginRound,roundRoll,SPACES,COLORS,ICONS,LABELS,LIFTS,SHOWDOWNS,publicBoard,start,roll,pickDie,choose,answer,tick,finishTurn,nextTurn,beginMove,resolveChallenge,minigameInput,minigameDraw,hostPause,hostResume,skipDisconnected,resumeClocks,DIRECTORS_CUES,DIRECTORS_CHOICE_MS,HEADLINE_WIN_BONUS,HEADLINE_LOSS_PENALTY,UNDERDOG_THRESHOLD,UNDERDOG_BONUS_SMALL,UNDERDOG_BONUS_EIGHT};
