'use strict';
(async () => {
  const U = window.Noggin;
  const $ = U.el;
  const sessionKey = 'noggin-tv-session-v1';
  const socket = io({reconnection:true,reconnectionDelay:500,reconnectionDelayMax:3000});
  let avatars = [], activeRoom = null, priorCount = 0, boardView = null, currentState = null;
  const audio=new window.NogginSound();let lastFxKey='',lastBeat=-1,lastMove=-1;
  const message = $('message');

  function error(text) {
    message.textContent = text;
    message.classList.toggle('hidden', !text);
  }
  function setConnected(value) {
    $('offline').classList.toggle('hidden', value);
    $('connectionLabel').textContent = value ? 'ON AIR' : 'OFFLINE';
    $('tvConnectionDot').classList.toggle('online', value);
    for (const el of document.querySelectorAll('.controls button,.controls select,.controls input')) {
      if (el.id === 'stageReady') continue;
      el.disabled = !value;
    }
    if (!value) $('stageReady').disabled = true;
  }
  const playSound=(pitch=1)=>audio.beep(550*pitch,.11,'sine');
  $('soundVolume').value=String(Math.round(audio.volume*100));
  $('soundVolume').oninput=e=>audio.setVolume(Number(e.target.value)/100);
  function updateSoundButton(){$('soundButton').textContent=!audio.enabled?'▶ Enable sound':audio.muted?'♫ Unmute TV':'♫ Mute TV';}
  $('soundButton').onclick=async()=>{try{const wasEnabled=audio.enabled;await audio.unlock();audio.setMuted(wasEnabled?!audio.muted:false);if(!audio.muted){audio.play('sfx-join');audio.startMusic(currentState?.phase==='lobby'?'lobby':'board');}updateSoundButton();}catch{error('Your browser blocked sound. Click the button again.');}};
  updateSoundButton();
  function showConfetti(){if(document.documentElement.classList.contains('reduce-motion'))return;
    const root=$('showFx');if(!root)return;root.replaceChildren();const colours=['#ffe478','#72ecf0','#ff7799','#c9a1ff','#a6f67a'];
    for(let i=0;i<65;i++){const bit=document.createElement('i');bit.className='confetti-bit';bit.style.left=`${(i*37)%100}%`;bit.style.setProperty('--bit',colours[i%colours.length]);bit.style.setProperty('--duration',`${2+(i%10)*.17}s`);root.append(bit);}
    setTimeout(()=>root.replaceChildren(),4200);
  }
  function gameFx(state){const b=state.board;if(!b)return;
    const key=[state.phase,b.step,b.turn,b.event?.text,b.minigame?.id,b.minigame?.roundKey,b.showdown?.kind,b.showdown?.phase].join('|');
    if(b.lastMove?.revision!==lastMove){lastMove=b.lastMove?.revision; if(lastMove!==undefined)audio.play('sfx-dice-roll');}
    if(key===lastFxKey)return;lastFxKey=key;
    if(b.step==='showdown'&&b.showdown?.phase==='intro')audio.play('sfx-showdown');
    if(b.step==='minigame'&&b.minigame?.phase==='intro')audio.play('sfx-reel');
    if(b.step==='result'){
       const won=(b.result?.winners||[]).length>0;
       audio.play(won?'sfx-spark-gain':'sfx-crowd-aww');
       if(won)showConfetti();else if(!document.documentElement.classList.contains('reduce-motion')){
         const board=$('boardCentre');board.classList.add('screen-shake');setTimeout(()=>board.classList.remove('screen-shake'),350);
       }
    }
    if(b.step==='finished'){audio.stopMusic();audio.play('mus-victory');showConfetti();}
    if(b.step==='await_roll')audio.startMusic('board');
    if((b.step==='showdown'||b.step==='minigame')&&!audio.muted)audio.startMusic('tension');
  }
  function drawRoster(state) {
    const area = $('roster');
    area.replaceChildren();
    const bySeat = new Map(state.players.map(p => [p.seat,p]));
    for (let seat = 1; seat <= 8; seat++) {
      const p = bySeat.get(seat);
      const card = document.createElement('div');
      card.className = `seat ${p ? 'filled' : ''} ${p?.ready ? 'ready' : ''} ${p && !p.online ? 'offline' : ''}`;
      if (p) {
        const avatar = avatars.find(a => a.id === p.avatarId);
        if (avatar) {
          const img = document.createElement('img'); img.src = avatar.think; img.alt = avatar.name; img.loading = 'lazy';
          img.onerror = () => {img.remove();const circle=document.createElement('span');circle.className='placeholder';circle.textContent=U.initials(p.name);card.prepend(circle);};
          card.append(img);
        }
        const name = document.createElement('div');name.className='seat-label';name.textContent=p.name;card.append(name);
        const label = document.createElement('span');label.className='seat-detail';label.textContent=`SEAT ${seat} · ${avatar?.name || 'Contestant'}`;card.append(label);
        const flag = document.createElement('span');flag.className='seat-flag';flag.textContent=!p.online ? 'RECONNECTING' : p.ready ? 'READY' : 'GETTING READY';card.append(flag);
      } else {
        const marker = document.createElement('div'); marker.className='placeholder'; marker.textContent='✦'; card.append(marker);
        const label = document.createElement('div');label.className='seat-label';label.textContent=`SEAT ${seat}`;card.append(label);
      }
      area.append(card);
    }
  }

  function render(state) {
    if (!activeRoom || state.code !== activeRoom) return;
    currentState=state;window.__nogginStateAt=Date.now();
    const playing=state.phase!=='lobby';document.body.classList.toggle('playing',playing);
    $('lobbyGrid').classList.toggle('hidden',playing);
    $('lobbyControls').classList.toggle('hidden',playing);
    $('gameStage').classList.toggle('hidden',!playing);
    if(playing){
      const b=state.board||{};
      $('gameReset').classList.toggle('hidden',state.phase!=='finished');
      $('showPause').classList.toggle('hidden',state.phase!=='board'||(b.paused&&b.pauseReason!=='The TV host has paused the show.'));
      $('showPause').textContent=b.paused?'▶ RESUME':'⏸ PAUSE';
      $('showPause').disabled=!socket.connected;
      $('showReport').disabled=!socket.connected;
      const active=state.players.find(p=>p.id===b.activeId);
      $('showSkip').classList.toggle('hidden',state.phase!=='board'||Boolean(active?.online)||!active||['result','finished'].includes(b.step)||b.pauseReason==='The TV host has paused the show.');
      $('showSkip').disabled=!socket.connected;
      if(boardView)boardView.render(state);
      if(!b.paused)gameFx(state);
      return;
    }
    if(audio.enabled&&!audio.muted)audio.startMusic('lobby');

    $('count').textContent = String(state.players.length);
    if (state.players.length > priorCount) audio.play('sfx-join');
    priorCount = state.players.length;
    drawRoster(state);
    $('rosterHelp').textContent = state.players.length < 2
      ? 'Need at least two contestants to play.'
      : state.canStart ? 'All contestants ready! Lobby check complete.' : 'Waiting for every contestant to tap READY on their phone…';
    $('stageReady').disabled = !state.canStart;
    $('stageReady').textContent = state.canStart ? '✓ LOBBY READY' : `WAITING FOR ${state.players.length < 2 ? '2 PLAYERS' : 'EVERYONE'}`;
    for(const [id,val] of [['target',state.settings.target],['timerSpeed',state.settings.timerSpeed]]) $(id).value=String(val);
    $('familyFriendly').checked=state.settings.familyFriendly;
    $('reduceMotion').checked=state.settings.reduceMotion;
    document.documentElement.classList.toggle('reduce-motion',state.settings.reduceMotion);
  }
  function showCreated(result) {
    activeRoom = result.code;
    if(boardView)boardView.lastRevision=-1;
    $('roomCode').textContent = result.code.split('').join(' ');
    $('qrImage').src = result.qrDataUrl;
    $('joinUrl').textContent = result.joinUrl;
    $('joinUrl').title = result.joinUrl;
    $('hostStatus').textContent = `ROOM ${result.code} · HOSTED ON THIS DEVICE`;
    error(''); priorCount=0;
    render(result.state);
  }
  async function startHost() {
    const previous = U.readSession(sessionKey);
    if (previous?.code && previous?.token) {
      try {
        const result = await U.request(socket,'room:resume',{code:previous.code,token:previous.token,role:'host'});
        showCreated(result);return;
      } catch {U.clearSession(sessionKey);}
    }
    try {
      const result = await U.request(socket,'room:create',{});
      U.saveSession(sessionKey,{code:result.code,token:result.token});
      showCreated(result);
    } catch(err) {error(err.message);}
  }
  socket.on('connect', () => {setConnected(true);startHost();});
  socket.on('disconnect', () => setConnected(false));
  socket.on('room:state', state => {if(activeRoom && state.code === activeRoom) render(state);});
  socket.on('room:session-replaced', () => {error('This host session is open in another browser tab. Close this tab.');socket.disconnect();});
  socket.on('room:closed',() => {U.clearSession(sessionKey);activeRoom=null;error('Room was closed. Reload to create a new one.');});

  async function updateSettings(patch) {
    if (!activeRoom || !socket.connected) return;
    try {render((await U.request(socket,'room:settings',{patch})).state);error('');}
    catch(err){error(err.message);}
  }
  $('target').onchange = e => updateSettings({target:Number(e.target.value)});
  $('timerSpeed').onchange = e => updateSettings({timerSpeed:e.target.value});
  $('familyFriendly').onchange = e => updateSettings({familyFriendly:e.target.checked});
  $('reduceMotion').onchange = e => updateSettings({reduceMotion:e.target.checked});
  $('newRoom').onclick = async () => {
    if (!socket.connected) return;
    if (!confirm('Close this room and disconnect every contestant?')) return;
    try {
      if (activeRoom) await U.request(socket,'room:close',{});
      U.clearSession(sessionKey); activeRoom=null;
      const result=await U.request(socket,'room:create',{});
      U.saveSession(sessionKey,{code:result.code,token:result.token});showCreated(result);
    } catch(err){error(err.message);}
  };
  $('showPause').onclick=async()=>{
    if(!activeRoom||!socket.connected)return;
    const isManual=currentState?.board?.paused&&currentState.board.pauseReason==='The TV host has paused the show.';
    try{const result=await U.request(socket,isManual?'game:resume':'game:pause',{});render(result.state);error('');}
    catch(err){error(err.message);}
  };
  $('showReport').onclick=async()=>{
    if(!activeRoom||!socket.connected)return;
    try{
      const result=await U.request(socket,'game:report',{});
      const blob=new Blob([JSON.stringify(result.report,null,2)+'\n'],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`NOGGIN-match-${activeRoom}-${new Date().toISOString().slice(0,10)}.json`;
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
      error('');
    }catch(e){error(e.message);}
  };
  $('showSkip').onclick=async()=>{
    if(!activeRoom||!socket.connected)return;
    const player=currentState?.players?.find(p=>p.id===currentState?.board?.activeId);
    if(!player||player.online||!confirm(`Skip ${player.name}'s turn because their phone is offline?`))return;
    try{const result=await U.request(socket,'game:skip-offline',{});render(result.state);error('');}
    catch(err){error(err.message);}
  };
  $('gameReset').onclick = ()=> $('newRoom').click();
  $('stageReady').onclick = async () => {
    if(!activeRoom||!socket.connected)return;
    try {const r=await U.request(socket,'game:start',{});render(r.state);error('');playSound();}
    catch(e){error(e.message);}
  };
  setInterval(()=>{boardView?.updateClock();if(!currentState?.board||audio.muted)return;
    const b=currentState.board;if(b.paused)return;const at=b.showdown?.deadline||b.minigame?.deadline||b.challenge?.deadline;
    if(!at)return;const sec=Math.ceil((at-(currentState.serverNow+Date.now()-((window.__nogginStateAt)||Date.now())))/1000);
    if(sec>=1&&sec<=3&&sec!==lastBeat){lastBeat=sec;audio.play('sfx-countdown');}if(sec>3)lastBeat=-1;
  },160);
  try {
    const response = await fetch('/shared/avatars.json');
    if(!response.ok)throw new Error('Avatar catalogue is missing.');
    avatars = await response.json();
    boardView = new window.NogginBoardView(avatars,playSound);await boardView.initialize();
    drawRoster({players:[]});if(currentState)render(currentState);
  } catch(err){error(err.message);}
})();
