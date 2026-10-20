'use strict';
(async () => {
  const U = window.Noggin, $ = U.el;
  const key = 'noggin-player-session-v1';
  const socket = io({reconnection:true,reconnectionDelay:500,reconnectionDelayMax:3000});
  let avatars = [], roomState = null, selectedId = null, session = null, lastLookedUpCode = '', currentlyResuming = false, currentDeadline = null, clockServer = null, clockLocal = null;
  let entryDraft={key:null,text:''};
  let interactionKey=null;
  let clockInitialMs=0;
  // Visual state is presentation-only. Multiplayer authority remains on the server.
  const gameLabels={
    'quick-draw':'SPEED','count-flash':'SPEED','odd-spot':'SPEED','colour-clash':'SPEED',
    'higher-lower':'BRAIN','memory-lane':'BRAIN','close-call':'BRAIN','unscramble':'BRAIN',
    'sketch-sabotage':'CREATE','noise-annoys':'CREATE','caption-this':'CREATE','fib-factory':'CREATE',
    'mind-meld':'TOGETHER','majority-rules':'TOGETHER','relay-sums':'TOGETHER','bomb-squad':'TOGETHER'
  };
  function setPhonePresentation(b){
    const m=b.minigame,show=b.showdown;
    document.body.dataset.nogginStep=b.step||'await_roll';
    document.body.dataset.nogginGame=m?.id||show?.kind||'board';
    document.body.dataset.gamePhase=m?.phase||show?.phase||(b.step==='result'?'result':'play');
    $('gameStateTag').textContent=b.paused?'PAUSED':b.step==='finished'?'SHOW OVER':
      b.step==='result'?'RESULTS':m?m.phase==='intro'?'GET READY':m.phase==='reveal'?'REVEAL':gameLabels[m.id]||'PLAY NOW':
      show?show.phase==='intro'?'SHOWDOWN':show.title||'SHOWDOWN':
      b.step==='await_roll'?'THE BOARD':b.step.startsWith('choose_')?'YOUR CHOICE':b.step==='challenge'?'QUESTION':'ON AIR';
  }

  // A game-state broadcast should not replace the phone keyboard or drawing pad.
  function controlKey(player,b){
    if(b.step==='minigame'&&b.minigame){
      const m=b.minigame;
      return [b.step,m.id,m.phase,m.roundKey,m.private?.role,m.private?.strokesLeft,
        m.private?.prompt,m.answered?.includes(player.id),m.voted?.includes(player.id),
        m.display?.keypadReady,m.display?.partnerId,m.display?.progress?.join?.(','),
        m.display?.options?.length].join('|');
    }
    if(b.step==='showdown'&&b.showdown){
      const m=b.showdown;
      return [b.step,m.kind,m.phase,m.roundKey,m.private?.qid,m.myCheer,
        m.display?.turnId,m.display?.bidderId,m.display?.banks?.includes(player.id),
        m.display?.answered?.includes(player.id)].join('|');
    }
    return [b.step,b.turn,b.paused].join('|');
  }
  function deadlineFor(b){
    if(b.step==='minigame'&&b.minigame)return b.minigame.phase==='intro'?b.minigame.introUntil:b.minigame.deadline;
    if(b.step==='showdown'&&b.showdown)return b.showdown.deadline;
    if(b.step==='result')return b.nextAt;
    if(b.step==='challenge')return b.challenge?.deadline;
    return b.deadline;
  }
  const parameters = new URLSearchParams(location.search);
  const roomParam = (parameters.get('room') || '').trim().toUpperCase();
  if (/^[A-Z2-9]{4}$/.test(roomParam)) $('code').value=roomParam;

  function error(msg) {$('error').textContent=msg;$('error').classList.toggle('hidden',!msg);if(msg)$('error').scrollIntoView({block:'nearest'});}
  function notice(msg) {$('notice').textContent=msg;$('notice').classList.toggle('hidden',!msg);}
  function setConnected(connected) {
    $('phoneDot').classList.toggle('online',connected);
    $('statusText').textContent=connected?'CONNECTED':'OFFLINE';
    $('joinButton').disabled=!connected || !selectedId;
    $('readyButton').disabled=!connected;
    $('changeAvatarButton').disabled=!connected;
    for(const btn of $('gameButtons').querySelectorAll('button'))btn.disabled=!connected;
  }
  function roomCode() {return $('code').value.replace(/\s/g,'').toUpperCase();}
  function currentPlayer() {return roomState?.players?.find(p => p.id === session?.playerId) || null;}

  function buildPicker(target, isChange) {
    const grid=$(target);grid.replaceChildren();
    for(const avatar of avatars){
      const taken=Boolean(roomState?.players?.find(p=>p.avatarId===avatar.id && p.id!==session?.playerId));
      const button=document.createElement('button');button.type='button';button.className=`avatar-choice ${selectedId===avatar.id?'selected':''} ${taken?'taken':''}`;
      button.disabled=taken;
      button.setAttribute('aria-pressed',String(selectedId===avatar.id));
      const image=document.createElement('img');image.src=avatar.think;image.alt='';image.loading='lazy';
      image.onerror=()=>{image.remove();const fallback=document.createElement('div');fallback.textContent=U.initials(avatar.name);fallback.className='placeholder';button.prepend(fallback);};
      const label=document.createElement('span');label.textContent=avatar.name;button.append(image,label);
      if(taken){const badge=document.createElement('span');badge.className='taken-tag';badge.textContent='TAKEN';button.append(badge);}
      button.onclick=()=>isChange?changeAvatar(avatar.id):chooseAvatar(avatar.id);
      grid.append(button);
    }
  }
  function chooseAvatar(id) {selectedId=id;buildPicker('avatarGrid',false);$('joinButton').textContent='JOIN THE SHOW!';$('joinButton').disabled=!socket.connected;}
  async function changeAvatar(id) {
    if(!session || !socket.connected)return;
    try {
      const result=await U.request(socket,'room:avatar',{avatarId:id});
      selectedId=id;roomState=result.state;
      $('swapPanel').classList.add('hidden');error('');render();
    } catch(err){error(err.message);}
  }

  function gameButton(text,event,payload={},style='button-blue') {
    const btn=document.createElement('button');btn.type='button';btn.textContent=text;btn.className=style;
    btn.disabled=!socket.connected;
    btn.onclick=async()=>{
      if(!socket.connected)return;
      btn.disabled=true;
      try{const r=await U.request(socket,event,payload);roomState=r.state;render();error('');if(navigator.vibrate)navigator.vibrate(35);}
      catch(e){error(e.message);btn.disabled=false;}
    };
    $('gameButtons').append(btn);
  }
  function numericOrWordControl(m,integer) {
    const form=document.createElement('form');form.className='mini-answer';
    const input=document.createElement('input');input.type=integer?'number':'text';input.required=true;input.autocomplete='off';input.autocapitalize=integer?'off':'characters';
    input.inputMode=integer?'numeric':'text';input.placeholder=integer?'YOUR NUMBER':'TYPE THE WORD';input.maxLength=40;
    if(integer){input.min='0';input.max='100000000';input.step='1';}
    input.setAttribute('aria-label',integer?'Your numerical guess':'Unscrambled word');
    const submit=document.createElement('button');submit.type='submit';submit.className='button-primary';submit.textContent='LOCK IN ANSWER';
    form.append(input,submit);form.onsubmit=async e=>{
      e.preventDefault();const value=integer?Number(input.value):input.value.trim();
      if(integer&&(!Number.isSafeInteger(value)||input.value.trim()==='')){error('Enter a valid whole number.');return;}
      submit.disabled=true;
      try{const r=await U.request(socket,'game:input',{value,roundKey:m.roundKey});roomState=r.state;error('');render();}
      catch(err){error(err.message);submit.disabled=false;}
    };
    $('gameButtons').append(form);
  }

  const phase4Ids=new Set(['sketch-sabotage','noise-annoys','caption-this','fib-factory','mind-meld','majority-rules','relay-sums','bomb-squad']);
  function p4Entry(m,{label='TYPE AN ANSWER',numeric=false,max=90,placeholder='YOUR ANSWER'}={}){
    const wrap=document.createElement('form');wrap.className='mini-answer p4-form';
    const input=document.createElement('input');input.type=numeric?'number':'text';input.maxLength=max;input.required=true;input.autocomplete='off';input.inputMode=numeric?'numeric':'text';input.placeholder=placeholder;
    if(numeric){input.min='0';input.max='9999';input.step='1';}
    input.setAttribute('aria-label',placeholder);
    const k=`${m.id}:${m.phase}:${m.roundKey}`;
    if(entryDraft.key===k)input.value=entryDraft.text;
    input.oninput=()=>{entryDraft={key:k,text:input.value};};
    const button=document.createElement('button');button.type='submit';button.className='button-primary';button.textContent=label;
    wrap.append(input,button);
    wrap.onsubmit=async(e)=>{
      e.preventDefault();const v=numeric?Number(input.value):input.value.trim();
      if(numeric&&(!Number.isSafeInteger(v)||input.value.trim()==='')){error('Enter a whole number.');return;}
      button.disabled=true;
      try{const r=await U.request(socket,'game:input',{value:v,roundKey:m.roundKey});entryDraft={key:null,text:''};roomState=r.state;render();error('');}
      catch(ex){error(ex.message);button.disabled=false;}
    };
    $('gameButtons').append(wrap);
  }
  function p4DrawCanvas(m){
    const label=document.createElement('div');label.className='mini-help';label.textContent=m.private?.role==='saboteur'?`SECRET SABOTEUR · ${m.private.strokesLeft} misleading strokes left`:`ARTIST · DRAW ${m.private?.word||'YOUR WORD'}`;$('gameButtons').append(label);
    const canvas=document.createElement('canvas');canvas.className='sketch-canvas';canvas.width=1000;canvas.height=700;canvas.setAttribute('aria-label','Draw here with a finger or mouse');
    canvas.dataset.strokeCount=String((m.display.strokes||[]).length);canvas.dataset.drawing='false';
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,700);ctx.lineWidth=9;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#152447';
    function paint(points){if(points.length<2)return;ctx.beginPath();ctx.moveTo(...points[0].map(v=>v*1));for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.stroke();}
    for(const stroke of m.display.strokes||[])paint(stroke.points);
    let points=[],drawing=false,started=0;
    const relative=(ev)=>{const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1000,Math.round((ev.clientX-r.left)/r.width*1000))),Math.max(0,Math.min(1000,Math.round((ev.clientY-r.top)/r.height*700)))]};
    canvas.onpointerdown=ev=>{if(!socket.connected)return;drawing=true;canvas.dataset.drawing='true';started=Date.now();points=[relative(ev)];canvas.setPointerCapture(ev.pointerId);ev.preventDefault();};
    canvas.onpointermove=ev=>{if(!drawing)return;const pt=relative(ev),last=points.at(-1);if(points.length>=70||Math.hypot(pt[0]-last[0],pt[1]-last[1])<8)return;points.push(pt);ctx.beginPath();ctx.moveTo(last[0],last[1]);ctx.lineTo(pt[0],pt[1]);ctx.stroke();ev.preventDefault();};
    canvas.onpointerup=async(ev)=>{if(!drawing)return;drawing=false;canvas.dataset.drawing='false';const end=relative(ev);if(points.length===1)points.push([Math.min(1000,end[0]+2),end[1]]);const payload={points,roundKey:m.roundKey};points=[];try{const r=await U.request(socket,'game:draw',payload);roomState=r.state;render();error('');}catch(ex){error(ex.message);render();}};
    canvas.onpointercancel=()=>{drawing=false;canvas.dataset.drawing='false';points=[];};
    $('gameButtons').append(canvas);
  }
  function renderPhase4(player,m){
    const id=player.id,host=roomState.board.activeId;
    $('gameHeadline').textContent=`${m.title.toUpperCase()}${m.totalRounds>1?` · ${m.round}/${m.totalRounds}`:''}`;
    $('gameDescription').textContent=m.rule;
    currentDeadline=m.phase==='intro'?m.introUntil:m.deadline;clockServer=roomState.serverNow;clockLocal=Date.now();
    if(m.phase==='intro'){$('gameButtons').textContent='GET READY! WATCH THE TV FOR THE RULES';return;}
    const info=(text)=>{const d=document.createElement('div');d.className='mini-help';d.textContent=text;$('gameButtons').append(d);};
    const sent=m.answered.includes(id),voted=m.voted?.includes(id);
    const pick=(text,value,style='button-blue')=>gameButton(text,'game:input',{value,roundKey:m.roundKey},style);
    if(m.id==='sketch-sabotage'){
      if(m.private?.role==='artist'||m.private?.role==='saboteur'){
        if(m.private.role==='saboteur'&&m.private.strokesLeft===0){info('THREE SABOTAGE STROKES USED — NOW WATCH THE TV');return;}
        p4DrawCanvas(m);
      }else{info(`Category: ${m.display.category}`);p4Entry(m,{label:'GUESS THE DRAWING',placeholder:'WHAT IS IT?',max:55});}
    }else if(m.id==='noise-annoys'){
      if(id===host){info(`YOUR SECRET SOUND: ${m.private?.clue||'Look for your clue'}`);info('Make the noise aloud. No words and no miming.');}
      else{info('LISTEN TO THE HOST IN THE ROOM');p4Entry(m,{label:'SUBMIT GUESS',placeholder:'WHAT WAS THAT SOUND?',max:65});}
    }else if(m.id==='caption-this'){
      info('SCENE: '+m.question);
      if(m.phase==='play'){if(sent)info('CAPTION LOCKED IN — WAIT FOR VOTING');else p4Entry(m,{label:'SEND YOUR CAPTION',placeholder:'YOUR FUNNIEST CAPTION',max:110});}
      else if(voted)info('YOUR VOTE IS LOCKED IN');
      else (m.display.options||[]).forEach((c,i)=>{if(m.private?.myEntryIndex===i)return;pick(`${i+1}. ${c}`,i,'button-blue small');});
    }else if(m.id==='fib-factory'){
      info(m.question);
      if(m.phase==='play'){if(sent)info('YOUR FIB IS LOCKED IN');else p4Entry(m,{label:'SUBMIT YOUR FIB',placeholder:'A CONVINCING FAKE ANSWER',max:65});}
      else if(voted)info('YOUR CHOICE IS LOCKED IN');
      else (m.display.options||[]).forEach((c,i)=>{if(m.private?.myEntryIndex===i)return;pick(`${i+1}. ${c}`,i,'button-blue small');});
    }else if(m.id==='mind-meld'){
      info(m.question);
      if(m.phase==='partner'){
        if(id!==host)info('THE HOST IS PICKING A PARTNER');
        else (m.display.partners||[]).forEach((pid,i)=>{const name=roomState.players.find(p=>p.id===pid)?.name||'Contestant';pick(`PARTNER: ${name}`,i);});
      }else if(m.phase==='reveal'){info(`PREVIOUS WORDS: ${(m.lastResult?.words||[]).join(' / ')}`);info('ANOTHER ATTEMPT STARTS SHORTLY');}
      else if(id===host||id===m.display.partnerId){if(sent)info('WORD LOCKED IN — DO NOT TELL YOUR PARTNER!');else p4Entry(m,{label:'LOCK IN WORD',placeholder:'ONE WORD OR SHORT PHRASE',max:32});}
      else info('WATCH THE TV — ONLY THE TWO PARTNERS PLAY THIS ROUND');
    }else if(m.id==='majority-rules'){
      info(m.question);if(sent)info('SECRET VOTE LOCKED IN');else (m.display.options||[]).forEach((v,i)=>pick(v,i,'button-primary'));
    }else if(m.id==='relay-sums'){
      const team=m.display.teams.findIndex(ids=>ids.includes(id));info(`YOU ARE TEAM ${team+1} · ${m.display.progress[team]}/${m.display.totals[team]} SUMS DONE`);
      if(m.private?.role==='relay-solver'){info(m.private.prompt);p4Entry(m,{label:'SUBMIT SUM',numeric:true,max:4,placeholder:'YOUR ANSWER'});}
      else info('WAIT FOR YOUR TURN IN THE RELAY');
    }else if(m.id==='bomb-squad'){
      for(const clue of m.private?.clues||[])info(clue);
      if(id===host){
        if(!m.display.keypadReady){info('CUT THE WIRES IN THE ORDER REVEALED BY YOUR TEAM');for(const wire of m.display.wires||[])if(!m.display.cut.includes(wire))pick(`✂ CUT ${wire} WIRE`,wire,'button-blue');}
        else{info('ALL WIRES CUT! ENTER THE FOUR-DIGIT CODE.');p4Entry(m,{label:'DEFUSE THE BOMB',numeric:false,max:4,placeholder:'4-DIGIT CODE'});}
      }else info('READ YOUR CLUE(S) ALOUD TO THE HOST!');
    }
    if(entryDraft.key===`${m.id}:${m.phase}:${m.roundKey}` && document.activeElement?.tagName==='BODY'){
      // Do not pop the keyboard open when a user has not started typing.
    }
  }

  function renderShowdown(player,m){
    const mine=m.participants.includes(player.id);
    const info=t=>{const x=document.createElement('div');x.className='mini-help';x.textContent=t;$('gameButtons').append(x);};
    const choose=(label,value)=>gameButton(label,'game:input',{value,roundKey:m.roundKey},'button-primary');
    const numberForm=(label,placeholder,numeric=true)=>{
      const form=document.createElement('form');form.className='mini-answer p4-form';
      const input=document.createElement('input');input.type=numeric?'number':'text';input.placeholder=placeholder;input.required=true;input.autocomplete='off';input.inputMode=numeric?'numeric':'text';input.maxLength=70;
      const button=document.createElement('button');button.className='button-primary';button.type='submit';button.textContent=label;
      form.append(input,button);form.onsubmit=async e=>{e.preventDefault();const v=numeric?Number(input.value):input.value.trim();if(numeric&&(!Number.isSafeInteger(v)||v<0||!input.value.trim())){error('Enter a valid whole number.');return;}
        const value=m.kind==='tug'?{answer:v,qid:m.private?.qid}:v;button.disabled=true;
        try{const r=await U.request(socket,'game:input',{value,roundKey:m.roundKey});roomState=r.state;render();error('');if(navigator.vibrate)navigator.vibrate(35);}
        catch(e){error(e.message);button.disabled=false;}
      };$('gameButtons').append(form);
    };
    $('gameHeadline').textContent=m.title;
    $('gameDescription').textContent=m.question;
    currentDeadline=m.deadline;clockServer=roomState.serverNow;clockLocal=Date.now();
    if(m.kind==='bid' && m.phase==='review'){
      info('ANSWER UNDER REVIEW — THE VIP WILL DECIDE.');
      if(roomState.vipId===player.id && m.display.bidderId===player.id) info('AS BIDDER, YOU CANNOT JUDGE YOUR OWN ANSWER. THE TV HOST MUST DECIDE.');
      if(roomState.vipId===player.id && m.display.bidderId!==player.id){
        info(`PROPOSED ANSWER: ${m.display.review?.answer||''}`);
        gameButton('✓ ACCEPT ANSWER','game:bid-review',{accept:true},'button-primary');
        gameButton('✕ REJECT ANSWER','game:bid-review',{accept:false},'button-blue');
      }
      return;
    }
    if(!mine){
      if(m.kind==='tiebreak'){info('SUDDEN DEATH — WATCH THE FINALISTS');return;}
      if(roomState.settings.rules!=='showtime'){info('WATCH THE SHOWDOWN ON THE TV');return;}
      info('🎬 SPOTLIGHT PICK · Back the winner BEFORE the duel. Earn 1 Director Cue if correct (max 2); no Sparks at risk.');
      if(m.myCheer)info(`PREDICTION LOCKED: ${roomState.players.find(p=>p.id===m.myCheer)?.name||'CHALLENGER'}`);
      else if(m.cheerOpen)for(const id of m.participants){
        const contestant=roomState.players.find(p=>p.id===id);
        gameButton(`🎬 BACK ${contestant?.name||'CHALLENGER'}`,'game:cheer',{targetId:id},'button-blue');
      }else info('PREDICTIONS LOCKED — WATCH THE SHOWDOWN');
      return;
    }
    if(m.phase==='intro'){info('WATCH THE TV. THE SHOWDOWN STARTS AFTER THE COUNTDOWN.');return;}
    if(m.kind==='buzzer'){
      info(`QUESTION ${m.round}/7 · ${Object.entries(m.display.points).map(([id,v])=>`${roomState.players.find(p=>p.id===id)?.name}: ${v}`).join(' vs ')}`);
      if(m.phase==='buzz')choose('⚡ BUZZ!','buzz');
      else if(m.display.answerId===player.id){info('YOU BUZZED FIRST. ANSWER NOW!');m.display.choices.forEach((choice,i)=>choose(choice,i));}
      else info('WAIT — THE OTHER CHALLENGER IS ANSWERING.');
    }else if(m.kind==='tug'){
      info(`ROPE POSITION: ${m.display.rope}`);info(m.private?.prompt||'WAIT FOR THE NEXT SUM');
      if(m.private?.prompt)numberForm('PULL THE ROPE','YOUR ANSWER');
    }else if(m.kind==='bid'){
      info(`CURRENT BID: ${m.display.bid} · MAXIMUM: ${m.display.max}`);
      if(m.phase==='auction'){
        if(m.display.turnId!==player.id){info('OTHER PLAYER IS BIDDING.');return;}
        for(let n=m.display.bid+1;n<=Math.min(m.display.max,m.display.bid+4);n++)choose(`I CAN NAME ${n}`,{action:'bid',count:n});
        if(m.display.bidderId)choose('CHALLENGE THAT BID!',{action:'challenge'});
      }else if(m.phase==='name'){
        info(`${m.display.correct}/${m.display.bid} CORRECT · ${m.display.invalid}/3 INVALID`);
        if(m.display.bidderId===player.id)numberForm('SUBMIT CATEGORY ANSWER','TYPE ONE ITEM',false);
        else info('THE HIGH BIDDER IS NAMING THEIR ITEMS.');
      }
    }else if(m.kind==='nerve'){
      info(`CURRENT COUNTER: ${m.display.number}`);
      if(m.display.banks.includes(player.id))info('BANKED! WAIT FOR THE OTHER PLAYER.');
      else choose('🏦 BANK NOW','bank');
    }else if(m.kind==='tiebreak'){
      info(`ENTER YOUR CLOSEST GUESS (${m.display.unit||'NUMBER'})`);
      if(m.display.answered.includes(player.id))info('GUESS LOCKED IN');
      else numberForm('LOCK IN MY GUESS','YOUR BEST NUMBER');
    }
  }

  function renderMiniGame(player,m) {
    const eligible=m.participants.includes(player.id)&&!m.eliminated.includes(player.id);
    const answered=m.answered.includes(player.id);
    $('gameHeadline').textContent=`${m.title.toUpperCase()} · ${m.round}/${m.totalRounds}`;
    $('gameDescription').textContent=m.rule+'  '+m.question;
    currentDeadline=m.phase==='intro'?m.introUntil:m.deadline;clockServer=roomState.serverNow;clockLocal=Date.now();
    if(m.phase==='intro'){$('gameDescription').textContent=m.rule+' Watch the TV for a five-second example.';$('gameButtons').textContent='GET READY — WATCH THE TV DEMO';return;}
    if(m.phase==='reveal'){
      const result=m.lastRoundResult||{},answer=result.answer;
      $('gameDescription').textContent=answer===undefined?'ROUND COMPLETE':`CORRECT ANSWER: ${answer}`;
      const win=(result.winners||[]).includes(player.id);
      $('gameButtons').textContent=win?'★ YOU WON THIS ROUND! ★':'ROUND OVER — NEXT ONE STARTS SHORTLY';return;
    }
    if(!eligible){$('gameButtons').textContent='YOU ARE OUT — WATCH THE TV';return;}
    if(answered){$('gameButtons').textContent='✓ LOCKED IN — WATCH THE TV';return;}
    const send=(text,value,style='button-blue')=>gameButton(text,'game:input',{value,roundKey:m.roundKey},style);
    if(m.id==='quick-draw'){
      send(m.phase==='wait'?'✋ WAIT FOR DRAW!':'⚡ DRAW! TAP NOW!',1,'button-primary');
    } else if(m.phase==='flash'){
      $('gameButtons').textContent='👀 WATCH THE TV FIRST';
    } else if(m.id==='count-flash'||m.id==='close-call') numericOrWordControl(m,true);
    else if(m.id==='unscramble') numericOrWordControl(m,false);
    else if(m.id==='odd-spot'){
      const grid=document.createElement('div');grid.className='mini-grid';
      Array.from({length:36},(_,i)=>i).forEach(i=>{const btn=document.createElement('button');btn.type='button';btn.className='mini-grid-button';const glyph=document.createElement('span');glyph.textContent=m.display.grid[i];btn.append(glyph);const style=m.display.styles?.[i];if(style?.rotation)glyph.style.transform=`rotate(${style.rotation}deg)`;if(style?.tone)glyph.style.color=style.tone;btn.setAttribute('aria-label',`Square ${i+1}: ${m.display.grid[i]}`);btn.disabled=!socket.connected;
        btn.onclick=async()=>{btn.disabled=true;try{const r=await U.request(socket,'game:input',{value:i,roundKey:m.roundKey});roomState=r.state;render();error('');}
          catch(e){error(e.message);btn.disabled=false;}};grid.append(btn);});
      $('gameButtons').append(grid);
    }else if(m.id==='colour-clash'){
      const word=document.createElement('div');word.className='stroop-word';word.textContent=m.display.word;word.style.color=({RED:'#ff7284',BLUE:'#78c7ff',GREEN:'#a5f480',YELLOW:'#ffe37a'})[m.display.ink];$('gameButtons').append(word);
      ['RED','BLUE','GREEN','YELLOW'].forEach((v,i)=>send(v,i));
    } else if(m.id==='higher-lower'){
      const strikes=document.createElement('div');strikes.className='mini-help';strikes.textContent=`STRIKES: ${m.strikes?.[player.id]||0}/2 · SECOND WRONG ANSWER ELIMINATES`; $('gameButtons').append(strikes);
      ['HIGHER','LOWER'].forEach((v,i)=>send(v,i,'button-primary'));
    } else if(m.id==='memory-lane'){
      const prog=m.progress[player.id]||0;
      const hint=document.createElement('div');hint.className='mini-help';hint.textContent=`${m.display.reverse?'FINAL ROUND — REPEAT THE PATTERN BACKWARDS!':'Repeat in the same order'} · ${prog} of ${m.display.sequenceLength} pads`;
      $('gameButtons').append(hint);const grid=document.createElement('div');grid.className='memory-pads';
      const symbols=['●','◆','▲','■','★','✦'];
      symbols.forEach((v,i)=>{const btn=document.createElement('button');btn.type='button';btn.className=`memory-pad pad-${i}`;btn.textContent=v;btn.onclick=async()=>{btn.disabled=true;try{const r=await U.request(socket,'game:input',{value:i,roundKey:m.roundKey});roomState=r.state;render();error('');}catch(e){error(e.message);btn.disabled=false;}};grid.append(btn);});
      $('gameButtons').append(grid);
    }
    if(m.blocked[player.id]&&m.blocked[player.id]>roomState.serverNow){
      const notice=document.createElement('div');notice.className='mini-help';notice.textContent='Wrong answer — short penalty before another try.';$('gameButtons').append(notice);
    }
  }
  const shortInstructions=Object.freeze({
    'quick-draw':'Wait for DRAW, then tap faster than everyone else.',
    'count-flash':'Remember the objects, then count the requested type.',
    'odd-spot':'Find the odd symbol; tap the same square.',
    'colour-clash':'Tap the ink colour, not the written word.',
    'higher-lower':'Guess higher or lower; two mistakes knock you out.',
    'memory-lane':'Repeat the pads; reverse the final sequence in Showtime.',
    'close-call':'Guess the number; the closest answer scores most.',
    'unscramble':'Unscramble the word using its category clue.',
    'sketch-sabotage':'Sketch or guess the word; watch for sneaky strokes.',
    'noise-annoys':'Make or guess sounds; do not use words.',
    'caption-this':'Write a funny caption, then vote for another.',
    'fib-factory':'Invent a believable fib, then spot the truth.',
    'mind-meld':'Write the same word as your partner without talking.',
    'majority-rules':'Vote secretly; matching the majority earns points.',
    'relay-sums':'Solve your sum to unlock the next teammate.',
    'bomb-squad':'Share clues, cut wires in order, then enter the code.'
  });
  function renderGame(player) {
    document.body.classList.add('game-mode');notice('');
    $('joinScreen').classList.add('hidden');$('lobbyScreen').classList.add('hidden');$('gameScreen').classList.remove('hidden');
    const b=roomState.board;document.body.classList.toggle('mini-mode',['minigame','showdown'].includes(b.step));
    const instruction=$('gameMiniInstruction');instruction.textContent=b.step==='minigame'?shortInstructions[b.minigame?.id]||'':'';instruction.classList.toggle('hidden',!instruction.textContent);
    setPhonePresentation(b);
    const active=roomState.players.find(p=>p.id===b.activeId),me=player.id===b.activeId;
    const avatar=avatars.find(a=>a.id===player.avatarId),won=(b.result?.winners||b.winnerIds||[]).includes(player.id);
    const image=b.step==='finished'?(b.winnerIds.includes(player.id)?avatar?.images?.win:avatar?.images?.lose):b.step==='result'?(won?avatar?.images?.win:avatar?.images?.lose):avatar?.think;
    $('gameAvatar').src=image||'';$('gameAvatar').alt=avatar?.name||player.name;
    $('gameName').textContent=player.name;$('gameSparks').textContent=`✦ ${player.sparks} SPARKS${roomState.settings.rules==='showtime'?` · 🎬 ${player.cues||0} CUES${b.headline?' · 🔥 HEADLINE BET':''}`:''}`;
    $('gameRoom').textContent=`ROOM ${session.code} · SEAT ${player.seat}`;
    $('gameTurn').textContent=b.step==='finished'?'GAME OVER':`TURN ${b.turn} · ${active?.name||'PLAYER'}'S TURN`;
    const priorInput=$('gameButtons').querySelector('form input');
    const priorFocused=Boolean(priorInput&&document.activeElement===priorInput);
    const activeCanvas=$('gameButtons').querySelector('canvas.sketch-canvas');
    const freshKey=controlKey(player,b);
    const keepInteraction=!b.paused&&freshKey===interactionKey&&(priorFocused||Boolean(activeCanvas));
    if(keepInteraction){
      currentDeadline=deadlineFor(b);clockServer=roomState.serverNow;clockLocal=Date.now();
      if(b.step==='minigame'&&b.minigame){
        const m=b.minigame;
        $('gameHeadline').textContent=phase4Ids.has(m.id)?m.title.toUpperCase():`${m.title.toUpperCase()} · ${m.round}/${m.totalRounds}`;
        $('gameDescription').textContent=phase4Ids.has(m.id)?m.rule:`${m.rule}  ${m.question}`;
        if(activeCanvas&&activeCanvas.dataset.drawing!=='true'){
          const strokes=m.display?.strokes||[],seen=Number(activeCanvas.dataset.strokeCount||0);
          if(strokes.length>seen){
            const ctx=activeCanvas.getContext('2d');ctx.strokeStyle='#152447';ctx.lineWidth=9;ctx.lineCap='round';ctx.lineJoin='round';
            for(const stroke of strokes.slice(seen)){
              if(!Array.isArray(stroke.points)||stroke.points.length<2)continue;
              ctx.beginPath();ctx.moveTo(...stroke.points[0]);
              for(const point of stroke.points.slice(1))ctx.lineTo(...point);
              ctx.stroke();
            }
            activeCanvas.dataset.strokeCount=String(strokes.length);
          }
        }
      }else if(b.step==='showdown'&&b.showdown){
        $('gameHeadline').textContent=b.showdown.title;
        $('gameDescription').textContent=b.showdown.question;
      }
      return;
    }
    interactionKey=freshKey;
    clockInitialMs=Math.max(1000,Number(deadlineFor(b))-Number(roomState.serverNow));
    if(priorInput)entryDraft={key:entryDraft.key,text:priorInput.value};
    $('gameButtons').replaceChildren();currentDeadline=null;
    const title=$('gameHeadline'),detail=$('gameDescription');
    if(b.paused){title.textContent='GAME PAUSED';detail.textContent=b.pauseReason||'Waiting for a player to reconnect.';return;}
    if(b.step==='finished'){
      title.textContent=b.winnerIds.includes(player.id)?'YOU WON NOGGIN!':'THE SHOW IS OVER';
      detail.textContent=b.event?.text||'The final scores are on the TV.';return;
    }
    if(b.step==='showdown'&&b.showdown){renderShowdown(player,b.showdown);return;}
    if(b.step==='minigame'&&b.minigame){if(phase4Ids.has(b.minigame.id)){renderPhase4(player,b.minigame);if(priorFocused){const el=$('gameButtons').querySelector('.p4-form input');if(el){el.focus();if(el.type==='text')el.setSelectionRange(el.value.length,el.value.length);}}}else renderMiniGame(player,b.minigame);return;}
    if(b.step==='round_roll'){
      const rolled=Boolean(b.round?.rolls?.[player.id]);
      title.textContent=rolled?'ROLL LOCKED IN':'EVERYONE ROLL!';
      detail.textContent=rolled?'Waiting for the other contestants.': 'Roll now. The server rolls automatically if you miss the countdown.';
      currentDeadline=b.deadline;clockServer=roomState.serverNow;clockLocal=Date.now();
      if(!rolled){
        gameButton('🎲 ROLL DICE','game:roll',{},'button-primary');
        if(roomState.settings.rules==='showtime'){
          const plan=Boolean(b.round?.directors?.[player.id]);
          const bet=Boolean(b.round?.headlines?.[player.id]);
          if(player.cues>0||plan)gameButton(plan?'✕ CANCEL DIRECTOR’S CUT':'🎬 DIRECTOR’S CUT · NUDGE ±1', 'game:choose',{action:plan?'normal':'director'},'button-director');
          if(player.sparks>0||bet)gameButton(bet?'✕ CANCEL HEADLINE BET':'🔥 HEADLINE BET · +2 OR −1','game:choose',{action:bet?'safe':'headline'},'button-headline');
        }
      }
    } else if(b.step==='round_moving'){
      title.textContent='WATCH THE BOARD';detail.textContent=b.event?.text||'Moving everyone in seat order.';
    } else if(b.step==='await_roll'){
      title.textContent=me?'YOUR TURN!':'WATCH THE DICE';
      detail.textContent=me&&roomState.settings.rules!=='showtime'?'Tap ROLL DICE to play.':me?(b.routePlan?'DIRECTOR’S CUT: roll, then select a landing. Nudging costs one Cue.':'Your call: choose your landing, or risk a Spark on the next challenge. Earn fresh Cues by WINNING challenges.'): `It's ${active?.name}'s turn. Watch the stage.`;
      if(me){
        gameButton('🎲 ROLL DICE','game:roll',{},'button-primary');
        if(roomState.settings.rules==='showtime'&&(player.cues>0 || b.routePlan)) gameButton(b.routePlan?'✕ CANCEL DIRECTOR’S CUT':`🎬 PLAN A LANDING · ${player.cues||0} CUES`, 'game:choose',{action:b.routePlan?'normal':'director'},'button-director');
        if(roomState.settings.rules==='showtime'&&(player.sparks>0||b.headline))gameButton(b.headline?'🛡 CANCEL HEADLINE BET':`🔥 HEADLINE BET · +2 IF YOU WIN / −1 EXTRA IF YOU LOSE`, 'game:choose',{action:b.headline?'safe':'headline'},'button-headline');
      }
    } else if(b.step==='choose_route'){
      title.textContent='🎬 DIRECTOR’S CUT';detail.textContent=me?'Choose where to land. Your normal roll is FREE; ±1 space costs one Cue. Make the crowd gasp!':`${active?.name} is selecting their landing.`;
      currentDeadline=b.deadline;clockServer=roomState.serverNow;clockLocal=Date.now();
      if(me)b.routeOptions.forEach((o,index)=>gameButton(`${o.cost?'🎬':'✓'} ${o.steps} STEPS · ${o.type.toUpperCase()} ${o.cost?'(−1 CUE)':'(FREE)'}`, 'game:choose',{option:index},o.cost?'button-director':'button-primary'));
    } else if(b.step==='choose_die'){
      title.textContent=me?'PICK YOUR DIE':'CATCH-UP ROLL';detail.textContent=me?'You are behind: choose either die to move with.':'The current contestant picks one die.';
      if(me)b.rolls.forEach((die,index)=>gameButton(`DIE ${index+1}: ${die} SPACES`,'game:pick-die',{index},'button-primary'));
    } else if(['choose_target','choose_opponent'].includes(b.step)) {
      const swap=b.step==='choose_target';title.textContent=swap?'SWAP SEATS!':'CHALLENGE A RIVAL!';
      detail.textContent=me?(swap?'Choose whose board position to swap with.':'Pick another contestant to face in the showdown.'):b.event?.text;
      if(me)roomState.players.filter(p=>p.id!==player.id).forEach(p=>gameButton(`${p.name} · ${p.sparks} SPARKS`,'game:choose',{targetId:p.id},'button-blue small'));
    } else if(b.step==='choose_category'){
      title.textContent='WILDCARD!';detail.textContent=me?'Choose a challenge category. All four categories now have real games.':b.event?.text;
      if(me)['speed','brain','create','together'].forEach(cat=>gameButton(cat.toUpperCase(),'game:choose',{category:cat},'button-blue small'));
    } else if(b.step==='challenge'){
      const c=b.challenge, eligible=c.participants.includes(player.id),answered=c.answered.includes(player.id);
      title.textContent=c.title;detail.textContent=c.question;
      currentDeadline=c.deadline;clockServer=roomState.serverNow;clockLocal=Date.now();
      if(eligible&&!answered)c.choices.forEach((answer,index)=>gameButton(answer,'game:answer',{choice:index},'button-primary'));
      else{const note=document.createElement('div');note.className='already-answered';note.textContent=!eligible?'Watch the TV — this round is for the challengers.':'ANSWER LOCKED IN ✓ — Watch the TV';$('gameButtons').append(note);}
    } else if(b.step==='result'){
      title.textContent=won?'★ WINNING FACE ★':'RESULTS ARE IN';detail.textContent=b.result?.text||'Next turn starts shortly.';
      currentDeadline=b.nextAt;clockServer=roomState.serverNow;clockLocal=Date.now();
    }
  }
  function updateGameClock(){
    if(roomState?.board?.paused){$('gameCountdown').textContent='⏸ PAUSED';$('gameClockFill').style.width='100%';document.body.classList.remove('time-critical');return;}
    if(currentDeadline&&clockServer!==null){
      const remaining=Math.max(0,currentDeadline-(clockServer+Date.now()-clockLocal));
      const seconds=Math.ceil(remaining/1000);
      $('gameCountdown').textContent=seconds?`⏱ ${seconds} SECONDS`:'⏱ TIME!';
      $('gameClockFill').style.width=`${Math.min(100,Math.max(0,remaining/Math.max(1000,clockInitialMs)*100))}%`;
      document.body.classList.toggle('time-critical',seconds>0&&seconds<=5);
    }else{$('gameCountdown').textContent='';document.body.classList.remove('time-critical');}
  }
  function renderVipControls() {
    const player = currentPlayer();
    const isVip = player && roomState?.vipId === player.id;
    for (const id of ['vipControls', 'vipGameControls']) {
      const panel = $(id);
      panel.replaceChildren();
      panel.classList.toggle('hidden', !isVip || (id === 'vipControls') !== (roomState.phase === 'lobby'));
      if (!isVip || (id === 'vipControls') !== (roomState.phase === 'lobby')) continue;
      const heading = document.createElement('h3');
      heading.textContent = '★ VIP HOST CONTROLS';
      panel.append(heading);
      const add = (label, event, payload = {}) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'button-secondary vip-control';
        button.textContent = label;button.disabled = !socket.connected;
        button.onclick = async () => {
          if (event === 'room:close' && !confirm('Close this room for everybody?')) return;
          button.disabled = true;
          try {
            const response = await U.request(socket, event, payload);
            if (response.state) roomState = response.state;
            if (event === 'game:report') {
              const blob = new Blob([JSON.stringify(response.report, null, 2)], {type:'application/json'});
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');link.href=url;
              link.download=`noggin-match-${session.code}.json`;link.click();
              setTimeout(() => URL.revokeObjectURL(url),1000);
            }
            if (event !== 'room:close') {error('');render();}
          } catch(e) {error(e.message);button.disabled = false;}
        };
        panel.append(button);
      };
      if (roomState.phase === 'lobby') {
        for(const [setting, choices] of Object.entries({
          roundStyle: [['everyone','Everyone rolls'],['sequential','One at a time']],
          rules: [['classic','Classic'],['showtime','Showtime']],
          target: [[8,'8 Sparks'],[12,'12 Sparks'],[16,'16 Sparks']],
          timerSpeed: [['normal','Normal'],['relaxed','Relaxed']]
        })) {
          const label = document.createElement('label');
          label.textContent = ({roundStyle:'ROUND STYLE',rules:'GAME MODE',target:'TARGET',timerSpeed:'TIMERS'})[setting];
          const select = document.createElement('select');select.setAttribute('aria-label',label.textContent);
          for (const [value,name] of choices) {const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}
          select.value=String(roomState.settings[setting]);
          select.onchange=async()=>{try{const value=setting==='target'?Number(select.value):select.value;const r=await U.request(socket,'room:settings',{patch:{[setting]:value}});roomState=r.state;render();error('');}catch(e){error(e.message);render();}};
          label.append(select);panel.append(label);
        }
        add('▶ START SHOW','game:start');
      } else {
        add(roomState.board?.paused?'▶ RESUME':'⏸ PAUSE',roomState.board?.paused?'game:resume':'game:pause');
        add('SKIP OFFLINE PLAYER','game:skip-offline');
        add('DOWNLOAD MATCH REPORT','game:report');
      }
      add('CLOSE ROOM','room:close');
    }
  }
  function render() {
    if(!session || roomState?.phase==='lobby')buildPicker('avatarGrid',false);
    if(!session || !roomState) return;
    const player=currentPlayer();
    if(!player)return;
    if(roomState.phase!=='lobby'){renderGame(player);renderVipControls();return;}
    document.body.classList.remove('game-mode','mini-mode','time-critical');document.body.dataset.nogginStep='lobby';$('gameScreen').classList.add('hidden');
    $('joinScreen').classList.add('hidden');$('lobbyScreen').classList.remove('hidden');
    $('greeting').textContent=`HELLO, ${player.name.toUpperCase()}!`;
    $('yourSeat').textContent=`SEAT ${player.seat} · ROOM ${session.code}`;
    const avatar=avatars.find(a=>a.id===player.avatarId);
    $('yourAvatar').src=avatar?.think || '';
    $('yourAvatar').alt=avatar?.name || player.name;
    $('yourCharacter').textContent=avatar?.name || player.name;
    $('lobbyCount').textContent=`${roomState.players.length} of 8 contestants joined · ${roomState.players.filter(p=>p.ready).length} ready`;
    $('readyButton').textContent=player.ready ? '✓ READY — TAP TO UNREADY' : 'I\'M READY!';
    $('readyButton').className=player.ready?'button-blue join-button':'button-primary join-button';
    $('changeAvatarButton').disabled=player.ready || !socket.connected;
    buildPicker('swapAvatarGrid',true);
    renderVipControls();
    if(!roomState.hostOnline) notice('The TV host is disconnected. Your seat is being held temporarily.');
    else notice(roomState.canStart ? 'Everyone is ready! Watch the TV for the next step.' : 'Waiting for the rest of the panel.');
  }
  function saveSession(result, name, avatarId) {
    session={code:result.code,token:result.token,playerId:result.playerId,name,avatarId};
    U.saveSession(key,session);roomState=result.state;
  }
  async function resumeSession() {
    if(currentlyResuming) return;
    const prior=U.readSession(key);
    if(!prior?.token||!prior?.code)return;
    currentlyResuming=true;
    try {
      const r=await U.request(socket,'room:resume',{code:prior.code,token:prior.token,role:'player'});
      session=prior;roomState=r.state;
      const player=currentPlayer();selectedId=player?.avatarId || prior.avatarId;
      $('code').value=prior.code;$('playerName').value=prior.name;
      render();error('');
    } catch(err) {
      session=null;roomState=null;U.clearSession(key);
      $('joinScreen').classList.remove('hidden');$('lobbyScreen').classList.add('hidden');$('gameScreen').classList.add('hidden');
      error(`Your previous seat is unavailable: ${err.message}`);
    } finally {currentlyResuming=false;}
  }
  async function peekRoom() {
    const code=roomCode();
    if(!/^[A-Z2-9]{4}$/.test(code) || session || !socket.connected || code===lastLookedUpCode)return;
    lastLookedUpCode=code;
    try {
      const r=await U.request(socket,'room:peek',{code});
      if(roomCode()!==code)return;
      roomState=r.state;
      $('roomHint').textContent=`Room found · ${r.state.players.length} contestant(s) joined`;
      buildPicker('avatarGrid',false);
    } catch(err){$('roomHint').textContent=err.message;}
  }
  $('code').oninput=()=>{
    $('code').value=roomCode();lastLookedUpCode='';
    if($('code').value.length===4)peekRoom();
  };
  $('joinForm').onsubmit=async e=>{
    e.preventDefault();error('');
    const code=roomCode(),name=$('playerName').value.trim();
    if(!selectedId){error('Choose your character first.');return;}
    if(!/^[A-Z2-9]{4}$/.test(code)){error('Enter the four-character code from the TV.');return;}
    $('joinButton').disabled=true;
    try {
      const result=await U.request(socket,'room:join',{code,name,avatarId:selectedId});
      saveSession(result,name,selectedId);
      render();error('');
      if(navigator.vibrate) navigator.vibrate(30);
    } catch(err){error(err.message);$('joinButton').disabled=false; if(err.message.includes('taken')){lastLookedUpCode='';peekRoom();}}
  };
  $('readyButton').onclick=async()=>{
    const p=currentPlayer();if(!p)return;
    try{
      const result=await U.request(socket,'room:ready',{ready:!p.ready});roomState=result.state;render();error('');
      if(navigator.vibrate)navigator.vibrate(25);
    }catch(err){error(err.message);}
  };
  $('changeAvatarButton').onclick=()=>{$('swapPanel').classList.toggle('hidden');};
  $('leaveButton').onclick=async()=>{
    try{if(socket.connected)await U.request(socket,'room:leave',{});}catch{}
    U.clearSession(key);session=null;roomState=null;selectedId=null;
    $('joinScreen').classList.remove('hidden');$('lobbyScreen').classList.add('hidden');$('swapPanel').classList.add('hidden');$('gameScreen').classList.add('hidden');
    buildPicker('avatarGrid',false);error('');notice('You left the room.');
  };
  socket.on('connect',()=>{setConnected(true);resumeSession().then(()=>{if(!session)peekRoom();});});
  socket.on('disconnect',()=>{setConnected(false);if(session)notice('Connection lost. Your seat is reserved for 30 seconds while we reconnect…');});
  socket.on('room:state',state=>{
    if(session && state.code!==session.code)return;
    if(!session && roomCode()!==state.code)return;
    roomState=state;if(session)render();else buildPicker('avatarGrid',false);
  });
  socket.on('room:closed',()=>{U.clearSession(key);session=null;roomState=null;error('The TV host closed this room. Enter the new code to rejoin.');$('joinScreen').classList.remove('hidden');$('lobbyScreen').classList.add('hidden');$('gameScreen').classList.add('hidden');});
  socket.on('room:session-replaced',()=>{U.clearSession(key);session=null;error('Your player session opened on another device or tab. Reload if you want to take it back.');socket.disconnect();});
  setInterval(updateGameClock,200);
  try {
    const r=await fetch('/shared/avatars.json');if(!r.ok)throw new Error('Unable to load avatar catalogue.');
    avatars=await r.json();buildPicker('avatarGrid',false);
    if(socket.connected){await resumeSession();if(!session)peekRoom();}
  }catch(err){error(err.message);}
})();
