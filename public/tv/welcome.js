'use strict';
/* NOGGIN front-of-show layer. Does not alter the room or match engine. */
(() => {
  const splash=document.getElementById('welcomeScreen');
  if(!splash)return;
  const $=id=>document.getElementById(id);
  const expressions=['think','win','lose'];
  const names={think:'thinking',win:'celebrating',lose:'reacting to a loss'};
  fetch('/shared/avatars.json',{cache:'no-cache'})
    .then(r=>{if(!r.ok)throw Error('Avatar catalogue unavailable');return r.json();})
    .then(avatars=>{
      if(!Array.isArray(avatars))return;
      const frag=document.createDocumentFragment();
      avatars.forEach(a=>{
        const expression=expressions[Math.floor(Math.random()*3)];
        const card=document.createElement('div');card.className='welcome-cast-frame';
        card.title=a.name+' — '+names[expression];
        const img=document.createElement('img');
        img.src=a.images?.[expression]||a.think;
        img.alt=a.name+' — '+names[expression];
        img.width=108;img.height=108;img.loading='eager';img.decoding='async';
        img.onerror=()=>{if(img.src!==new URL(a.think,location.href).href)img.src=a.think;};
        card.append(img);frag.append(card);
      });
      $('welcomeCast').replaceChildren(frag);
    })
    .catch(()=>{$('welcomeCast').textContent='THE NOGGIN CONTESTANTS ARE READY!';});
  function dismiss(focusId){
    splash.classList.add('welcome-dismissed');
    splash.setAttribute('aria-hidden','true');
    setTimeout(()=>{splash.hidden=true;$(focusId)?.focus();},250);
  }
  $('welcomeStart').addEventListener('click',()=>dismiss('target'));
  $('welcomeSettings').addEventListener('click',()=>dismiss('soundButton'));
  const rules=$('welcomeRulesDialog');
  $('welcomeHowTo').addEventListener('click',()=>{rules.hidden=false;$('welcomeRulesClose').focus();});
  function closeRules(){rules.hidden=true;$('welcomeHowTo').focus();}
  $('welcomeRulesClose').addEventListener('click',closeRules);
  rules.addEventListener('click',e=>{if(e.target===rules)closeRules();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!rules.hidden)closeRules();});
  $('welcomeRulesPlay').addEventListener('click',()=>{rules.hidden=true;dismiss('target');});
  const qr=$('qrImage'),code=$('roomCode'),link=$('joinUrl');
  function updateJoin(){
    const src=qr?.getAttribute('src');
    if(src){$('welcomeQR').src=src;$('welcomeQR').hidden=false;$('welcomeJoinHint').hidden=true;}
    const room=code?.textContent?.replace(/\s/g,'');
    if(room&&room!=='····')$('welcomeRoomCode').textContent=room;
    const url=link?.textContent;
    if(url&&url!=='Connecting…')$('welcomePhoneUrl').textContent=url;
  }
  if(qr&&code&&link){
    const observer=new MutationObserver(updateJoin);
    [qr,code,link].forEach(node=>observer.observe(node,{attributes:true,childList:true,subtree:true,characterData:true}));
    updateJoin();
  }
})();