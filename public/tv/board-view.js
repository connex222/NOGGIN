'use strict';
class NogginBoardView {
  constructor(avatars,onHop,onDiceFx) {this.avatars=avatars;this.onHop=onHop;this.onDiceFx=onDiceFx;this.data=[];this.lastRevision=-1;this.animTimer=null;this.moveAnimating=false;this.pendingMove=null;this.diceTimers=[];this.diceSequence=0;this.diceKey=null;this.tokenGroup=null;this.latestState=null;this.lastCueKey=null;this.flashHandles=[];}
  async initialize() {
    const res=await fetch('/shared/board-data.json');if(!res.ok)throw Error('Board layout metadata missing.');
    this.data=await res.json();this.buildBoard();
  }
  // Screen-space geometry for the live 36-space, neon double-curve racetrack.
  // Space indices are unchanged: only the TV positions move. Gameplay is server-owned.
  positions() {
    const p={0:[740,472]};
    for(let i=1;i<=7;i++){
      const x=740-i*85;
      p[i]=[x,472-18*(1-Math.pow((x-800)/710,2))];
    }
    [[8,90,415],[9,77,337],[10,91,252],[11,135,184]].forEach(([i,x,y])=>p[i]=[x,y]);
    for(let i=12;i<=23;i++){
      const x=195+(i-12)*110;
      p[i]=[x,150+38*(1-Math.pow((x-800)/710,2))];
    }
    [[24,1465,185],[25,1506,252],[26,1522,336],[27,1497,414]].forEach(([i,x,y])=>p[i]=[x,y]);
    for(let i=28;i<=35;i++){
      const x=1432-(i-28)*85;
      p[i]=[x,472-18*(1-Math.pow((x-800)/710,2))];
    }
    return p;
  }
  el(name,props={},text) {const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v] of Object.entries(props))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;}
  buildBoard() {
    const svg=document.getElementById('boardGraphic'),E=this.el.bind(this);
    svg.replaceChildren();this.points=this.positions();
    const defs=E('defs');
    const glow=E('filter',{id:'nogginTileGlow',x:'-80%',y:'-80%',width:'260%',height:'260%'});
    glow.append(E('feGaussianBlur',{stdDeviation:'8',result:'blur'}),E('feMerge',{}));
    // Tile colours are from the real board metadata, never the reference illustration.
    this.data.forEach(({type,color})=>{
      if(defs.querySelector('#arena-'+type))return;
      const g=E('linearGradient',{id:'arena-'+type,x1:'0%',x2:'18%',y1:'0%',y2:'100%'});
      g.append(E('stop',{offset:'0%','stop-color':'#ffffff','stop-opacity':'.64'}),E('stop',{offset:'35%','stop-color':color,'stop-opacity':'1'}),E('stop',{offset:'100%','stop-color':color,'stop-opacity':'.88'}));defs.append(g);
    });svg.append(defs);
    const pts=Array.from({length:36},(_,i)=>this.points[i]);
    const d='M '+pts.map(p=>p.join(' ')).join(' L ')+' Z';
    // Opaque illuminated rail covers static artwork tiles so there are never
    // two conflicting board layouts. The stage painting remains behind it.
    svg.append(E('path',{d,fill:'none',stroke:'#020823','stroke-width':111,'stroke-linejoin':'round','stroke-linecap':'round',opacity:'.99'}));
    svg.append(E('path',{d,fill:'none',stroke:'#ffb644','stroke-width':105,'stroke-linejoin':'round','stroke-linecap':'round',opacity:'.95'}));
    svg.append(E('path',{d,fill:'none',stroke:'#0c1e56','stroke-width':94,'stroke-linejoin':'round','stroke-linecap':'round'}));
    svg.append(E('path',{d,fill:'none',stroke:'#ffe7a1','stroke-width':2.6,'stroke-linejoin':'round',opacity:'.78'}));
    svg.append(E('path',{d,fill:'none',stroke:'#ffe9a6','stroke-width':5,'stroke-linejoin':'round','stroke-dasharray':'3 17',opacity:'.94'}));
    const edge=E('g',{id:'boardSpaces'});
    this.data.forEach(({index,type,icon,label})=>{
      const xy=this.points[index];if(!xy)return;
      const [x,y]=xy;const show=type==='showdown',w=show?79:76,h=show?70:64;
      const g=E('g',{class:`board-space type-${type}`,transform:`translate(${x},${y})`});
      g.append(E('rect',{x:-w/2-4,y:-h/2-2,width:w+8,height:h+8,rx:14,fill:'#060e32',stroke:'#ffe69a','stroke-width':2.2}));
      g.append(E('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:12,fill:`url(#arena-${type})`,stroke:show?'#fff9c0':'#fff2cc','stroke-width':2}));
      g.append(E('path',{d:`M ${-w/2+9} ${-h/2+7} H ${w/2-9}`,stroke:'#fff','stroke-opacity':'.48','stroke-width':2.5,'stroke-linecap':'round'}));
      g.append(E('text',{y:-2,class:'space-icon'},icon));
      g.append(E('text',{y:h/2-10,class:'space-number'},String(index+1)));
      g.append(E('title',{},`Space ${index+1}: ${label||type}`));
      edge.append(g);
    });svg.append(edge);
    this.routeLayer=E('g',{id:'directorRouteLayer','aria-hidden':'true'});svg.append(this.routeLayer);
    this.tokenGroup=E('g',{id:'boardTokens'});svg.append(this.tokenGroup);
  }
  renderShowdown(m,state){
    const panel=document.getElementById('challengePanel'),prompt=document.getElementById('challengePrompt'),options=document.getElementById('challengeChoices');
    panel.classList.remove('hidden');panel.classList.add('mini-on-tv','duel-on-tv');options.replaceChildren();
    document.getElementById('challengeType').textContent=m.kind==='tiebreak'?'★ SUDDEN DEATH ★':'★ CORNER SHOWDOWN ★';
    document.getElementById('challengeTitle').textContent=m.phase==='intro'?'HOW TO PLAY · '+m.title.toUpperCase():m.title.toUpperCase();
    prompt.textContent=m.question;
    this.clockAt=m.deadline;this.clockServer=state.serverNow;this.clockLocal=Date.now();
    const label=(text,cls='p4-ballot')=>{const x=document.createElement('div');x.className=cls;x.textContent=text;options.append(x);return x;};
    const names=m.participants.map(id=>state.players.find(p=>p.id===id)?.name||'Contestant');
    if(m.cheerCounts && Object.values(m.cheerCounts).some(Boolean)){
      const crowd=document.createElement('div');crowd.className='audience-meter';
      const total=Object.values(m.cheerCounts).reduce((a,b)=>a+b,0);
      crowd.setAttribute('aria-label',`${total} audience Spotlight Picks`);
      m.participants.forEach((id,index)=>{
        const count=m.cheerCounts[id]||0,line=document.createElement('div');line.className='audience-side';
        const text=document.createElement('span');text.textContent=`${names[index]} · ${count} ${count===1?'PICK':'PICKS'}`;
        const track=document.createElement('div');track.className='audience-track';
        const fill=document.createElement('div');fill.className='audience-fill';fill.style.width=`${total?100*count/total:0}%`;
        track.append(fill);line.append(text,track);crowd.append(line);
      });
      options.append(crowd);
    }
    if(m.phase==='intro'){if(state.settings.rules==='showtime'&&m.kind!=='tiebreak')label('AUDIENCE: PREDICT THE WINNER NOW · EARN 1 DIRECTOR CUE','mini-preview');label(m.kind==='buzzer'?'BUZZ FIRST · ANSWER FAST':m.kind==='tug'?'FIRST TO PULL FIVE NOTCHES':m.kind==='bid'?'BID A NUMBER · THEN NAME THEM':m.kind==='nerve'?'BANK BEFORE THE HIDDEN BUST':'CLOSEST NUMBER WINS','mini-preview');return;}
    if(m.kind==='buzzer'){
      const pts=m.participants.map(id=>m.display.points[id]);label(`${names[0]} ${pts[0]} : ${pts[1]} ${names[1]}`,'p4-big');
      label(`QUESTION ${m.round} OF 7 · ${m.phase==='buzz'?'BUZZ TO ANSWER':m.phase==='answer'?'FIRST BUZZER IS ANSWERING':'SECOND CHALLENGER GETS A CHANCE'}`);
      for(const c of m.display.choices||[])label(c,'showdown-choice');
    }else if(m.kind==='tug'){
      const rope=document.createElement('div');rope.className='duel-rope';const mark=document.createElement('span');mark.className='duel-knot';mark.style.left=`${50+m.display.rope*8}%`;rope.append(mark);options.append(rope);
      label(`${names[0]}   ◀ ${m.display.rope} ▶   ${names[1]}`,'p4-big');
      label('FIVE NOTCHES WINS · ONLY YOUR PHONE SEES YOUR SUM');
    }else if(m.kind==='bid'){
      label(`CURRENT BID: ${m.display.bid}`,'p4-big');
      label(m.phase==='auction'?`${state.players.find(p=>p.id===m.display.turnId)?.name||'Player'}: RAISE THE BID OR CHALLENGE!`:`${state.players.find(p=>p.id===m.display.bidderId)?.name||'Bidder'}: ${m.display.correct}/${m.display.bid} ANSWERS ACCEPTED`);
    }else if(m.kind==='nerve'){
      label(String(m.display.number),'nerve-counter');label(`${m.display.banks.length} OF ${m.participants.length} PLAYERS BANKED`);
      label('THE HIDDEN BUST POINT IS GETTING CLOSER!');
    }else if(m.kind==='tiebreak'){
      label(`${m.display.answered.length} OF ${m.participants.length} GUESSES IN`,'p4-big');
      label(`ANSWER IN ${m.display.unit||'A WHOLE NUMBER'} · CLOSEST WINS`);
    }
  }

  renderPhase4(m,state,prompt,options){
    const span=(t,cls='')=>{const x=document.createElement('div');x.textContent=t;x.className=cls;options.append(x);return x;};
    const actor=state.players.find(p=>p.id===state.board.activeId);
    if(m.phase==='intro'){
      document.getElementById('challengeTitle').textContent='HOW TO PLAY · '+m.title.toUpperCase();
      prompt.textContent=m.rule;
      span({'sketch-sabotage':'✎  DRAW · GUESS · SABOTAGE','noise-annoys':'🔊  MAKE THE SOUND!','caption-this':'✍  WRITE · THEN VOTE','fib-factory':'🎭  BLUFF · THEN FIND THE TRUTH','mind-meld':'♥  THINK AS ONE','majority-rules':'👥  PICK THE CROWD FAVOURITE','relay-sums':'➕  PASS THE BATON','bomb-squad':'✂  SHARE CLUES · DEFUSE'}[m.id],'mini-preview');return;
    }
    if(m.id==='sketch-sabotage'){
      prompt.textContent=`${actor?.name||'Artist'} draws · Category: ${m.display.category} · The Saboteur is hidden!`;
      const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=580;canvas.className='tv-sketch';const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,580);ctx.strokeStyle='#162b4c';ctx.lineWidth=8;ctx.lineCap='round';ctx.lineJoin='round';
      for(const entry of m.display.strokes||[]){const p=entry.points;if(p.length<2)continue;ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]*.82857);for(let i=1;i<p.length;i++)ctx.lineTo(p[i][0],p[i][1]*.82857);ctx.stroke();}
      options.append(canvas);
    } else if(m.id==='noise-annoys'){
      prompt.textContent=`${actor?.name||'The host'} is performing a mystery sound aloud in the room.`;span('🎤   LISTEN CAREFULLY','mini-preview');
    }else if(m.id==='caption-this'){
      prompt.textContent=m.question;const faces=document.createElement('div');faces.className='caption-avatars';
      for(const avatarId of m.display.avatars||[]){const avatar=this.avatars.find(a=>a.id===avatarId);if(!avatar)continue;const img=document.createElement('img');img.src=avatar.think;img.alt=avatar.name;faces.append(img);}options.append(faces);
      if(m.phase==='vote')for(const c of m.display.options||[])span(`“${c}”`,'p4-ballot');else span(`${m.display.entryCount||0} CAPTIONS IN · ANONYMOUS VOTE NEXT`);
    }else if(m.id==='fib-factory'){
      prompt.textContent=m.question;if(m.phase==='vote')for(const c of m.display.options||[])span(c,'p4-ballot');else span(`${m.display.entryCount||0} FIBS IN · TRUTH IS HIDDEN`);
    }else if(m.id==='mind-meld'){
      prompt.textContent=m.question;const p=state.players.find(p=>p.id===m.display.partnerId);span(`${actor?.name||'Host'}  +  ${p?.name||'CHOOSING PARTNER'}`,'p4-big');
      if(m.phase==='reveal')span(`They wrote: ${(m.lastResult?.words||[]).join(' / ')}`,'p4-ballot');else span(`ATTEMPT ${m.round} OF 3 · NO TALKING`);
    }else if(m.id==='majority-rules'){
      prompt.textContent=m.question;for(const c of m.display.options||[])span(c,'p4-ballot');span(`${m.answered.length}/${state.players.length} VOTES RECEIVED`);
    }else if(m.id==='relay-sums'){
      prompt.textContent='TWO TRAINS OF THOUGHT · SOLVE THE SUMS!';
      for(let team=0;team<2;team++){const id=m.display.activeIds[team],who=state.players.find(p=>p.id===id);span(`TEAM ${team+1}: ${m.display.progress[team]}/${m.display.totals[team]} · ${who?.name||'FINISHED'}`,'p4-ballot');}
    }else if(m.id==='bomb-squad'){
      prompt.textContent='FOUR WIRES · ONE KEYPAD · SHARE PRIVATE PHONE CLUES!';const wires=document.createElement('div');wires.className='p4-wires';
      for(const c of m.display.wires||[]){const d=document.createElement('span');d.textContent=m.display.cut.includes(c)?`✓ ${c}`:c;d.className='p4-wire '+c.toLowerCase()+(m.display.cut.includes(c)?' cut':'');wires.append(d);}options.append(wires);
      span(m.display.keypadReady?'WIRES CUT · ENTER THE FOUR-DIGIT CODE':'LISTEN TO YOUR TEAM · CUT THE RIGHT WIRE','p4-big');
    }
  }

  renderMini(m,state){
    const panel=document.getElementById('challengePanel');panel.classList.remove('hidden');panel.classList.add('mini-on-tv');
    document.getElementById('challengeType').textContent=`${m.category.toUpperCase()} · ROUND ${m.round}/${m.totalRounds}`;
    document.getElementById('challengeTitle').textContent=m.title.toUpperCase();
    const prompt=document.getElementById('challengePrompt'),options=document.getElementById('challengeChoices');
    prompt.textContent=m.question;options.replaceChildren();
    this.clockAt=m.phase==='intro'?m.introUntil:m.deadline;this.clockServer=state.serverNow;this.clockLocal=Date.now();
    const span=(str,cls='')=>{const el=document.createElement('span');el.textContent=str;if(cls)el.className=cls;options.append(el);return el;};
    if(m.category==='create'||m.category==='together'){prompt.classList.remove('stroop-tv');prompt.style.color='';this.renderPhase4(m,state,prompt,options);return;}
    if(m.phase==='reveal'){
      document.getElementById('challengeTitle').textContent='★ ANSWER REVEAL ★';
      prompt.classList.remove('stroop-tv');prompt.style.color='';
      prompt.textContent='ROUND '+m.round+' RESULTS';
      const result=m.lastRoundResult||{};
      const answer=result.answer;
      if(answer!==undefined)span(`ANSWER: ${answer}`,'p4-big');
      else span('ROUND COMPLETE','p4-big');
      const winners=(result.winners||[]).map(id=>state.players.find(p=>p.id===id)?.name).filter(Boolean);
      span(winners.length?`WINNERS: ${winners.join(' · ')}`:'NO ROUND WINNER','p4-ballot');
      span('NEXT ROUND IN A MOMENT','p4-ballot');return;
    }
    if(m.phase==='intro'){
      document.getElementById('challengeTitle').textContent='HOW TO PLAY · '+m.title.toUpperCase();
      prompt.textContent=m.rule;
      const preview={'quick-draw':'WAIT…   ⚡ DRAW!','count-flash':'⚽ ⚽ ⚽ ⚽   →   ?','odd-spot':'●  ●  ◆  ●','colour-clash':'RED  ≠  BLUE','higher-lower':'12   →   ?','memory-lane':'●  ◆  ▲  ★','close-call':'❓  ≈  100','unscramble':'K  E  T  T  L  E'}[m.id];
      span(preview,'mini-preview');
      return;
    }
    if(m.id==='odd-spot'){
      const grid=document.createElement('div');grid.className='mini-tv-grid';m.display.grid.forEach((sym,i)=>{const e=document.createElement('span');e.className='odd-tv-cell';const icon=document.createElement('b');icon.textContent=sym;const number=document.createElement('small');number.textContent=String(i+1);e.append(icon,number);grid.append(e);});options.append(grid);
    }else if(m.id==='colour-clash'){
      prompt.classList.add('stroop-tv');prompt.style.color=({RED:'#ff7284',BLUE:'#78c7ff',GREEN:'#a5f480',YELLOW:'#ffe37a'})[m.display.ink];
    }else if(m.id==='higher-lower'){
      span('HIGHER ▲');span('LOWER ▼');
      const remaining=m.participants.filter(id=>!m.eliminated.includes(id)).length;span(`${remaining} SURVIVORS · TWO STRIKES TO GO OUT`,'mini-help');
    }else if(m.id==='unscramble'){
      span(`HINT: ${m.hint}`);if(m.display.clue)span(`CLUE: ${m.display.clue}`);
    }else if(m.id==='quick-draw'){
      span(m.phase==='wait'?'HOLD YOUR NERVE':'⚡ DRAW! ⚡','mini-signal');
    }else if(m.id==='count-flash'){
      if(m.phase==='flash'&&m.tvCue){const {icon,distractor,count,total,seed,icons,counts}=m.tvCue;let x=seed||1;const rand=()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};
        const scene=document.createElement('div');scene.className='flash-scene flash-fakeout';
        const spots=Array.from({length:total},(_,i)=>i);for(let i=spots.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[spots[i],spots[j]]=[spots[j],spots[i]];}
        for(let i=0;i<total;i++){const el=document.createElement('span');el.textContent=icons&&counts?icons[i<counts[0]?0:i<counts[0]+counts[1]?1:2]:i<count?icon:distractor;const cell=spots[i];el.style.left=`${2+(cell%12)*8.1+rand()*1.6}%`;el.style.top=`${1+Math.floor(cell/12)*31+rand()*3}%`;scene.append(el);}options.append(scene);
      }else span(`HOW MANY ${m.display.targetIcon||'TARGETS'} DID YOU SEE?`);
    }else if(m.id==='memory-lane'){
      const pads=document.createElement('div');pads.className='tv-memory-pads';const icons=['●','◆','▲','■','★','✦'];
      icons.forEach((name,i)=>{const el=document.createElement('span');el.className=`tv-pad pad-${i}`;el.textContent=name;pads.append(el);});options.append(pads);
      // Broadcasts rebuild the DOM, so memory cues must be scheduled against
      // SERVER timestamps, not against the instant this browser rendered.
      // This also resumes a paused sequence at the correct pad rather than
      // restarting the whole pattern or playing notes during a pause.
      if(m.tvCue&&m.phase==='flash'&&!state.board?.paused){
        const sequence=m.tvCue.sequence;
        const base=m.openAt-(1000+sequence.length*750);
        const serverTime=state.serverNow;
        sequence.forEach((pad,index)=>{
          const begin=base+1000+index*750,end=begin+560;
          const light=()=>{const item=pads.children[pad];if(item)item.classList.add('lit');this.onHop?.([.85,.96,1.09,1.22,1.37,1.54][pad]);};
          const dim=()=>{const item=pads.children[pad];if(item)item.classList.remove('lit');};
          if(end<=serverTime)return;
          if(begin<=serverTime){pads.children[pad]?.classList.add('lit');}
          else this.flashHandles.push(setTimeout(light,begin-serverTime));
          this.flashHandles.push(setTimeout(dim,end-serverTime));
        });
      }
      if(m.phase==='play')span(m.display.reverse?'⚠ FINAL ROUND: TAP THE PADS IN REVERSE ORDER':'REPEAT THE SEQUENCE ON YOUR PHONES');
    }else if(m.id==='close-call')span(`ANSWER IN ${m.display.unit||'A NUMBER'}`);
    prompt.classList.toggle('stroop-tv',m.id==='colour-clash');if(m.id!=='colour-clash')prompt.style.color='';
  }
  render(state) {
    this.latestState=state;
    this.flashHandles.forEach(clearTimeout);this.flashHandles=[];
    const b=state.board;if(!b)return;
    document.getElementById('stageTurn').textContent=`ROUND ${b.turn}`;
    document.getElementById('stageTarget').textContent=`FIRST TO ${state.settings.target} SPARKS`;
    const actor=state.players.find(p=>p.id===b.activeId);
    document.getElementById('stageActive').textContent=b.paused?'⏸ SHOW PAUSED':b.step==='finished'?'THE SHOW IS OVER':`${actor?.name||'Contestant'} IS IN THE SPOTLIGHT`;
    document.getElementById('stageEvent').textContent=b.event?.text||'Roll to begin.';
    document.getElementById('stageHelp').textContent=b.paused?b.pauseReason:'The next turn starts automatically after results.';
    document.getElementById('boardMessage').textContent=b.paused?'⏸ SHOW PAUSED':b.step==='choose_route'?'🎬 DIRECTOR’S CUT · PICK A LANDING':b.step==='finished'?'★ WE HAVE A WINNER ★':b.step==='result'?b.result?.text:actor?`${actor.name.toUpperCase()} · ${b.step==='await_roll'?'ROLL THE DICE!':'USE YOUR HEAD'}`:'NOGGIN';
    this.renderScores(state);
    const hero=document.getElementById('arenaActiveAvatar');
    if(hero){const img=this.avatars.find(a=>a.id===actor?.avatarId)?.think;
      hero.hidden=!img;if(img)hero.src=img;hero.alt=actor?`${actor.name} is the active contestant`:'';}
    const cue=document.getElementById('arenaBottomCue');
    if(cue){const actions={await_roll:'🎲 ROLL ON YOUR PHONE',choose_die:'🎲 CHOOSE YOUR DIE',choose_route:'✦ PICK YOUR LANDING',minigame:'⚡ CHALLENGE IN PROGRESS',showdown:'★ SHOWDOWN LIVE',result:'✦ THE VERDICT',finished:'🏆 SHOW COMPLETE'};
      cue.textContent=b.paused?'⏸ SHOW PAUSED':actions[b.step]||'★ USE YOUR HEAD';}

    const panel=document.getElementById('challengePanel'), c=b.challenge;
    panel.classList.toggle('hidden',!c&&!b.minigame&&!b.showdown);
    panel.classList.toggle('mini-on-tv',Boolean(b.minigame||b.showdown));
    panel.classList.toggle('duel-on-tv',Boolean(b.showdown));
    if(b.minigame){this.renderMini(b.minigame,state);}
    if(b.showdown){this.renderShowdown(b.showdown,state);}
    if(c){document.getElementById('challengeType').textContent=c.title;document.getElementById('challengeTitle').textContent=c.kind==='drain'?'FIVE-SECOND CHALLENGE':c.kind==='showdown'?'DUEL!':c.kind==='tiebreak'?'SUDDEN DEATH':'QUICK CHOICE';
      document.getElementById('challengePrompt').textContent=c.question;
      const options=document.getElementById('challengeChoices');options.replaceChildren();for(const a of c.choices){const el=document.createElement('span');el.textContent=a;options.append(el);}this.clockAt=c.deadline;this.clockServer=state.serverNow;this.clockLocal=Date.now();}
    else if(!b.minigame&&!b.showdown) this.clockAt=null;
    this.paintRouteOptions(b);this.renderResultSpotlight(b,state);
    // Movement is replayed only for a NEW server-authoritative revision. Never
    // generate a number locally or restart the show when room:state repeats.
    const freshMove=b.lastMove?.revision!==undefined && b.lastMove.revision!==this.lastRevision;
    if(freshMove){
      this.lastRevision=b.lastMove.revision;
      this.pendingMove=b.lastMove;
      this.paintTokens(state.players,{playerId:b.lastMove.playerId,position:b.lastMove.from});
      this.showDie([b.lastMove.die],true,()=>{
        if(this.pendingMove?.revision!==b.lastMove.revision)return;
        this.pendingMove=null;
        this.animateMove(b.lastMove,this.latestState?.players||state.players);
      },`move-${b.lastMove.revision}`);
    }else if(!this.pendingMove&&!this.moveAnimating){this.paintTokens(state.players);}
    if(!freshMove && ['choose_die','choose_route'].includes(b.step)){
      this.showDie(b.rolls,true,null,`choice-${b.turn}-${b.activeId}-${b.rolls.join('-')}`,true,
        b.step==='choose_route'?'DIRECTOR’S CUT · PICK A LANDING':'CHOOSE YOUR DIE');
    }else if(!freshMove && !this.pendingMove && !this.moveAnimating && !['choose_die','choose_route'].includes(b.step))this.hideDie();
  }
  renderResultSpotlight(b,state){
    const root=document.getElementById('resultSpotlight');if(!root)return;
    const show=b.step==='result'||b.step==='finished';root.classList.toggle('hidden',!show);
    if(!show)return;
    const winnerIds=b.step==='finished'?b.winnerIds:(b.result?.winners||[]);
    const winner=state.players.find(p=>winnerIds.includes(p.id));
    const loser=state.players.find(p=>p.id===b.activeId && !winnerIds.includes(p.id));
    const makeFace=(p,expression)=>{if(!p)return null;const a=this.avatars.find(item=>item.id===p.avatarId);
      const portrait=document.createElement('figure');portrait.className=`spotlight-contestant ${expression}`;
      const pic=document.createElement('img');pic.src=a?.images?.[expression==='champion'?'win':'lose']||a?.think||'';pic.alt=p.name;
      pic.onerror=()=>{pic.style.display='none';};const name=document.createElement('figcaption');name.textContent=p.name;
      portrait.append(pic,name);return portrait;};
    const key=[b.step,b.turn,(b.result?.text||''),winnerIds.join(',')].join('|');
    if(root.dataset.key===key)return;
    root.dataset.key=key;root.replaceChildren();
    const label=document.createElement('div');label.className='spotlight-kicker';label.textContent=b.step==='finished'?'★ GRAND FINALE ★':'✦ THE VERDICT ✦';
    const faces=document.createElement('div');faces.className='spotlight-faces';
    if(winner){faces.append(makeFace(winner,'champion'));if(loser)faces.append(makeFace(loser,'runnerup'));}
    else if(loser)faces.append(makeFace(loser,'runnerup'));
    const lead=winner||loser,leadAvatar=this.avatars.find(a=>a.id===lead?.avatarId);
    const quote=document.createElement('div');quote.className='spotlight-quote';
    quote.textContent=leadAvatar?.banter?.[winner?'win':'lose']||'';
    const summary=document.createElement('div');summary.className='spotlight-copy';summary.textContent=b.result?.text||b.event?.text||'The verdict is in!';
    root.append(label,faces,quote,summary);
  }
  paintRouteOptions(b){
    if(!this.routeLayer)return;this.routeLayer.replaceChildren();
    if(b.step!=='choose_route')return;
    const shown=new Set();for(const o of b.routeOptions||[]){if(shown.has(o.landing))continue;shown.add(o.landing);const xy=this.points[o.landing];if(!xy)continue;
      const g=this.el('g',{class:`route-hint ${o.cost?'route-cost':'route-free'}`,transform:`translate(${xy[0]},${xy[1]})`});
      g.append(this.el('circle',{r:51,fill:'none',stroke:o.cost?'#ff8bbc':'#ffffff','stroke-width':6,'stroke-dasharray':o.cost?'9 6':'none'}));
      this.routeLayer.append(g);}
  }
  renderScores(state){const root=document.getElementById('scoreboard');root.replaceChildren();const b=state.board;
    state.players.forEach((p,index)=>{const avatar=this.avatars.find(a=>a.id===p.avatarId);const item=document.createElement('div');item.className=`score-seat ${b.leaderIds.includes(p.id)?'leader':''} ${p.id===b.activeId?'on-turn':''}`;
    const split=Math.ceil(state.players.length/2);const sideIndex=index<split?index:index-split;
    item.style.gridColumn=String(index<split?5-split+sideIndex:6+sideIndex);
    const img=document.createElement('img');img.src=(b.step==='finished'&&b.winnerIds.includes(p.id)?avatar?.images?.win:b.step==='result'?(b.result?.winners?.includes(p.id)?avatar?.images?.win:avatar?.images?.lose):avatar?.think)||'';img.alt='';img.onerror=()=>{img.style.display='none';};
    const label=document.createElement('span');label.textContent=p.name;const count=document.createElement('strong');count.textContent=`✦ ${p.sparks}${state.settings.rules==='showtime'?` · 🎬 ${p.cues||0}`:''}`;const meter=document.createElement('div');meter.className='spark-meter';meter.setAttribute('role','progressbar');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',String(state.settings.target));meter.setAttribute('aria-valuenow',String(Math.min(state.settings.target,p.sparks)));
    const bar=document.createElement('i');bar.style.width=`${Math.min(100,Math.round(p.sparks/state.settings.target*100))}%`;meter.append(bar);
    item.append(img,label,count,meter);root.append(item);});
  }
  paintTokens(players,override=null){
    if(!this.tokenGroup)return;
    const E=this.el.bind(this),activeId=this.latestState?.board?.activeId;
    this.tokenGroup.replaceChildren();
    const grouped=new Map();players.forEach(p=>{const position=override?.playerId===p.id?override.position:p.position;const list=grouped.get(position)||[];list.push({...p,position});grouped.set(position,list);});
    const rings=['#ffd968','#74f0eb','#ffa8c9','#a5ff88','#e0b2ff','#ffb178','#92baff','#fffcba'];
    for(const [pos,list] of grouped)for(let j=0;j<list.length;j++){
      const p=list[j],point=this.points[pos];if(!point)continue;
      const cols=Math.min(4,list.length),row=Math.floor(j/4),col=j%4;
      const dx=(col-(Math.min(cols,list.length-row*4)-1)/2)*34;
      const dy=-49-row*37;const active=p.id===activeId,r=active?23:20;
      const g=E('g',{class:`stage-token ${active?'active-token':''}`,transform:`translate(${point[0]+dx},${point[1]+dy})`});
      const avatar=this.avatars.find(a=>a.id===p.avatarId);
      if(active)g.append(E('circle',{r:r+5,fill:'#ffed82',opacity:'.32'}));
      const clipId=`token-clip-${p.seat}`;
      const clip=E('clipPath',{id:clipId});clip.append(E('circle',{r:r-2}));g.append(clip);
      if(avatar?.think)g.append(E('image',{href:avatar.think,x:-r+2,y:-r+2,width:2*r-4,height:2*r-4,preserveAspectRatio:'xMidYMid slice','clip-path':`url(#${clipId})`}));
      else g.append(E('circle',{r:r-2,fill:'#28345d'}));
      g.append(E('circle',{r:r-1,fill:'none',stroke:rings[(p.seat-1)%8],'stroke-width':active?4:3}));
      g.append(E('title',{},`${p.name}, space ${pos+1}`));
      this.tokenGroup.append(g);
    }
  }
  // Every 3D die has six physical faces. This is presentation only: the final
  // value is always read from the authoritative server state.
  createDie(value){
    const outer=document.createElement('div');outer.className='noggin-die-wrap';
    const cube=document.createElement('div');cube.className='noggin-die';
    const faces=[['front',1],['back',6],['right',3],['left',4],['top',2],['bottom',5]];
    const pips={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
    for(const [direction,faceValue] of faces){
      const face=document.createElement('div');face.className=`noggin-die-face die-${direction}`;
      for(const n of pips[faceValue]){
        const dot=document.createElement('i');dot.className='noggin-pip';
        dot.style.gridColumn=String((n-1)%3+1);dot.style.gridRow=String(Math.ceil(n/3));face.append(dot);
      }
      cube.append(face);
    }
    outer.append(cube);outer.dataset.result=String(value);
    return {outer,cube};
  }
  // Return the orientation which leaves the required face towards the audience.
  dieAngles(n){return ({1:[0,0],2:[-90,0],3:[0,-90],4:[0,90],5:[90,0],6:[0,180]})[n]||[0,0];}
  clearDiceTimers(){for(const id of this.diceTimers)clearTimeout(id);this.diceTimers=[];}
  showDie(numbers,tumble,onReveal=null,key=null,persist=false,customLabel=''){
    if(!Array.isArray(numbers)||!numbers.length)return;
    const values=numbers.filter(n=>Number.isInteger(n)&&n>=1&&n<=6);
    if(values.length!==numbers.length)return;
    const box=document.getElementById('diceOverlay');const tray=document.getElementById('diceTray');
    const text=document.getElementById('diceInfo');if(!box||!tray||!text)return;
    const identity=key||`roll-${numbers.join('-')}`;
    if(identity===this.diceKey&&!box.classList.contains('hidden'))return;
    this.diceKey=identity;
    this.clearDiceTimers();const seq=++this.diceSequence;
    const reduced=document.documentElement.classList.contains('reduce-motion')||
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const animate=Boolean(tumble&&!reduced);
    const dice=values.map(value=>this.createDie(value));
    tray.replaceChildren(...dice.map(d=>d.outer));
    tray.classList.toggle('double-roll',values.length===2);
    box.classList.remove('hidden');box.classList.toggle('dice-is-rolling',animate);
    text.textContent=animate?'ROLLING THE DICE…':(customLabel|| (values.length===2?'CHOOSE YOUR DIE':`IT'S A ${values[0]}!`));
    box.setAttribute('aria-label',`Dice roll: ${animate?'rolling':values.join(' and ')}`);
    for(const [i,{cube}] of dice.entries()){
      const [x,y]=this.dieAngles(values[i]);
      cube.style.transform=`rotateX(${x}deg) rotateY(${y}deg)`;
      if(animate&&typeof cube.animate==='function'){
        // Extra whole rotations keep the final face mathematically identical.
        cube.animate([
          {transform:'rotateX(-30deg) rotateY(22deg) rotateZ(-10deg) scale(.8)',offset:0},
          {transform:`rotateX(${390+x}deg) rotateY(${470+y}deg) rotateZ(32deg) scale(1.16)`,offset:.43},
          {transform:`rotateX(${790+x}deg) rotateY(${740+y}deg) rotateZ(-14deg) scale(.95)`,offset:.75},
          {transform:`rotateX(${1080+x}deg) rotateY(${1080+y}deg) rotateZ(0deg) scale(1)`,offset:1}
        ],{duration:1120+i*120,easing:'cubic-bezier(.21,.62,.28,1)',fill:'none'});
      }
    }
    this.onDiceFx?.('start');
    const finish=()=>{
      if(seq!==this.diceSequence)return;
      box.classList.remove('dice-is-rolling');
      text.textContent=customLabel?(values.length===2?`${customLabel} · ${values.join(' OR ')}`:customLabel):(values.length===2?`YOU ROLLED ${values[0]} & ${values[1]}`:`IT'S A ${values[0]}!`);
      box.setAttribute('aria-label',`Dice roll: ${values.join(' and ')}`);
      this.onDiceFx?.('land');
      onReveal?.();
      if(!persist)this.diceTimers.push(setTimeout(()=>{if(seq===this.diceSequence)this.hideDie();},650));
    };
    this.diceTimers.push(setTimeout(finish,animate?1240:0));
  }
  hideDie(){
    const box=document.getElementById('diceOverlay');if(!box)return;
    box.classList.add('hidden');box.classList.remove('dice-is-rolling');
    this.clearDiceTimers();this.diceSequence++;this.diceKey=null;
  }
  animateMove(move,players){
    clearInterval(this.animTimer);
    if(document.documentElement.classList.contains('reduce-motion')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
      this.moveAnimating=false;this.paintTokens(this.latestState?.players||players);return;
    }
    this.moveAnimating=true;let step=0;
    this.paintTokens(players,{playerId:move.playerId,position:move.from});
    this.animTimer=setInterval(()=>{
      if(step>=move.path.length){clearInterval(this.animTimer);this.moveAnimating=false;this.paintTokens(this.latestState?.players||players);return;}
      this.paintTokens(this.latestState?.players||players,{playerId:move.playerId,position:move.path[step++]});
      this.onHop?.(1+step*.085);
    },150);
  }
  updateClock(){if(this.latestState?.board?.paused){document.getElementById('challengeCountdown').textContent='⏸ CLOCK PAUSED';return;}if(this.clockAt){const remain=Math.max(0,Math.ceil((this.clockAt-(this.clockServer+Date.now()-this.clockLocal))/1000));document.getElementById('challengeCountdown').textContent=`${remain} SECONDS REMAINING`;}}
}
window.NogginBoardView=NogginBoardView;
