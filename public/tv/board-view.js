'use strict';
class NogginBoardView {
  constructor(avatars,onHop) {this.avatars=avatars;this.onHop=onHop;this.data=[];this.lastRevision=-1;this.animTimer=null;this.tokenGroup=null;this.latestState=null;this.lastCueKey=null;this.flashHandles=[];}
  async initialize() {
    const res=await fetch('/shared/board-data.json');if(!res.ok)throw Error('Board layout metadata missing.');
    this.data=await res.json();this.buildBoard();
  }
  positions() {
    const P={0:[555,625],7:[85,625],15:[310,104],22:[790,104],30:[1020,625]};
    [1,2,3,4,5,6].forEach((i,k)=>P[i]=[488-67*k,625]);
    for(let k=0;k<7;k++)P[8+k]=[118+k*29,554-k*65];
    for(let k=0;k<6;k++)P[16+k]=[376+k*68,104];
    for(let k=0;k<7;k++)P[23+k]=[820+k*29,164+k*65];
    for(let k=0;k<5;k++)P[31+k]=[955-k*82,625];
    return P;
  }
  el(name,props={},text) {const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v] of Object.entries(props))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;}
  buildBoard() {
    const svg=document.getElementById('boardGraphic'),E=this.el.bind(this);svg.replaceChildren();this.points=this.positions();
    const defs=E('defs'),grad=E('linearGradient',{id:'stageSurface',x1:'0%',y1:'0%',x2:'0%',y2:'100%'});
    grad.append(E('stop',{offset:'0%','stop-color':'#345492'}),E('stop',{offset:'100%','stop-color':'#1a2e5e'}));defs.append(grad);
    const shapes={speed:'M1 11 L11 1',brain:'M3 3 L4 4 M9 9 L10 10',create:'M1 4 L11 4',together:'M6 0 L6 12 M0 6 L12 6',showdown:'M0 0 L12 12 M12 0 L0 12',start:'M0 6 L12 6',swap:'M1 3 L11 3 M1 9 L11 9',pickpocket:'M2 2 L4 4 M8 8 L10 10',drain:'M0 3 L12 3 M0 9 L12 9',wildcard:'M0 0 L12 12 M2 10 L10 2',lift:'M3 0 L3 12 M9 0 L9 12'};
    for(const [type,d] of Object.entries(shapes)){
      const pattern=E('pattern',{id:`tile-${type}`,width:12,height:12,patternUnits:'userSpaceOnUse'});
      pattern.append(E('path',{d,stroke:'#ffffff','stroke-width':1.7,'stroke-opacity':.85,fill:'none'}));defs.append(pattern);
    }
    svg.append(defs);
    svg.append(E('ellipse',{cx:555,cy:660,rx:505,ry:37,fill:'#01061a',opacity:'.56'}));
    svg.append(E('polygon',{points:'307,85 793,85 1055,672 55,672',fill:'url(#stageSurface)',stroke:'#83a8d9','stroke-width':6}));
    for(let i=0;i<9;i++)svg.append(E('line',{x1:315+i*58,y1:115,x2:90+i*110,y2:652,stroke:'#6486be','stroke-width':1,opacity:'.25'}));
    const edge=E('g',{id:'boardSpaces'});
    this.data.forEach(({index,type,color,icon})=>{
      const [x,y]=this.points[index];const size=type==='showdown'?60:(y<120?49:56);const g=E('g',{class:`board-space type-${type}`,transform:`translate(${x},${y})`});
      const fill=color;
      g.append(E('rect',{x:-size/2,y:-size/2,width:size,height:size,rx:11,fill:fill,stroke:type==='showdown'?'#fff':'#dce9ff','stroke-width':type==='showdown'?4:2}));
      // CSS rect fills are overridden by inline attr using independent opacity background block.
      g.append(E('rect',{x:-size/2+3,y:-size/2+3,width:size-6,height:size-6,rx:8,fill:`url(#tile-${type})`,opacity:'.26',stroke:'none'}));
      g.append(E('text',{y:-6,class:'space-icon'},icon));g.append(E('text',{y:size/2-10,class:'space-number'},String(index+1)));
      if(type==='start')g.append(E('title',{},'START — 2 Sparks if landed on, 1 Spark for passing'));
      edge.append(g);
    });svg.append(edge);
    this.routeLayer=E('g',{id:'directorRouteLayer','aria-hidden':'true'});svg.append(this.routeLayer);
    const tokenLayer=E('g',{id:'boardTokens'});svg.append(tokenLayer);this.tokenGroup=tokenLayer;
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
    this.paintTokens(state.players);this.paintRouteOptions(b);this.renderResultSpotlight(b,state);
    if(['choose_die','choose_route'].includes(b.step)){this.showDie(b.rolls,false);if(b.step==='choose_route')document.getElementById('diceInfo').textContent='DIRECTOR’S CUT';}
    else if(!['choose_die','choose_route'].includes(b.step) && !b.lastMove)this.hideDie();
    if(b.lastMove?.revision!==undefined && b.lastMove.revision!==this.lastRevision){this.lastRevision=b.lastMove.revision;this.showDie([b.lastMove.die],true);this.animateMove(b.lastMove,state.players);}
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
      g.append(this.el('circle',{r:37,fill:'none',stroke:o.cost?'#ff8bbc':'#ffffff','stroke-width':6,'stroke-dasharray':o.cost?'9 6':'none'}));
      this.routeLayer.append(g);}
  }
  renderScores(state){const root=document.getElementById('scoreboard');root.replaceChildren();const b=state.board;
    state.players.forEach(p=>{const avatar=this.avatars.find(a=>a.id===p.avatarId);const item=document.createElement('div');item.className=`score-seat ${b.leaderIds.includes(p.id)?'leader':''}`;
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
      const dx=(col-(Math.min(cols,list.length-row*4)-1)/2)*25;
      const dy=-29-row*27;const active=p.id===activeId,r=active?17:14;
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
  showDie(numbers,tumble){
    const box=document.getElementById('diceOverlay'),cube=document.getElementById('diceCube');
    if(!numbers?.length)return;
    box.classList.remove('hidden');cube.textContent=numbers.map(n=>['','⚀','⚁','⚂','⚃','⚄','⚅'][n]||'🎲').join(' ');
    cube.classList.remove('tumbling');if(tumble){void cube.offsetWidth;cube.classList.add('tumbling');}
    document.getElementById('diceInfo').textContent=numbers.length>1?'CHOOSE A DIE':`ROLLED ${numbers[0]}`;
    clearTimeout(this.diceTimer);
    if(tumble)this.diceTimer=setTimeout(()=>this.hideDie(),1300);
  }
  hideDie(){document.getElementById('diceOverlay').classList.add('hidden');}
  animateMove(move,players){clearInterval(this.animTimer);if(document.documentElement.classList.contains('reduce-motion'))return;let step=0;
    this.paintTokens(players,{playerId:move.playerId,position:move.from});
    this.animTimer=setInterval(()=>{if(step>=move.path.length){clearInterval(this.animTimer);this.paintTokens(this.latestState?.players||players);return;}this.paintTokens(this.latestState?.players||players,{playerId:move.playerId,position:move.path[step++]});this.onHop?.(1+step*.085);},160);
  }
  updateClock(){if(this.latestState?.board?.paused){document.getElementById('challengeCountdown').textContent='⏸ CLOCK PAUSED';return;}if(this.clockAt){const remain=Math.max(0,Math.ceil((this.clockAt-(this.clockServer+Date.now()-this.clockLocal))/1000));document.getElementById('challengeCountdown').textContent=`${remain} SECONDS REMAINING`;}}
}
window.NogginBoardView=NogginBoardView;
