'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const splash = $('welcomeScreen');
  if (!splash) return;
  const expressions = ['think','win','lose'];
  const expressionsName = {think:'thinking',win:'celebrating',lose:'surprised'};
  let castChoices=[];
  fetch('/shared/avatars.json',{cache:'no-cache'}).then(r=>{
    if (!r.ok) throw Error('Avatar catalogue missing');
    return r.json();
  }).then(avatars=>{
    // Each character has one expression per opening. Repeat on both screens.
    castChoices=avatars.map(a=>({avatar:a,expression:expressions[Math.floor(Math.random()*3)]}));
    for(const id of ['welcomeCast','lobbyCast']){
      const host=$(id); if(!host)continue;
      const nodes=document.createDocumentFragment();
      for(const {avatar:a,expression} of castChoices){
        const frame=document.createElement('span');frame.className='showcase-cast-frame';
        const image=document.createElement('img');
        image.src=a.images[expression];image.alt=`${a.name} ${expressionsName[expression]}`;
        image.width=112;image.height=164;image.loading='eager';
        image.onerror=()=>{image.onerror=null;image.src=a.think;};
        frame.append(image);nodes.append(frame);
      }
      host.replaceChildren(nodes);
    }
  }).catch(()=>{
    for(const id of ['welcomeCast','lobbyCast'])if($(id))$(id).textContent='';
  });

  function goToLobby(focus){
    splash.classList.add('welcome-dismissed');
    splash.setAttribute('aria-hidden','true');
    window.setTimeout(()=>{splash.hidden=true;$(focus)?.focus();},180);
  }
  $('welcomeStart').addEventListener('click',()=>goToLobby('target'));
  $('welcomeJoin').addEventListener('click',()=>goToLobby('roomCode'));
  const rules=$('welcomeRulesDialog');
  $('welcomeHowTo').addEventListener('click',()=>{rules.hidden=false;$('welcomeRulesClose').focus();});
  function closeRules(){rules.hidden=true;$('welcomeHowTo').focus();}
  $('welcomeRulesClose').addEventListener('click',closeRules);
  rules.addEventListener('click',event=>{if(event.target===rules)closeRules();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!rules.hidden)closeRules();});
  $('welcomeRulesPlay').addEventListener('click',()=>{rules.hidden=true;goToLobby('target');});

  // The QR, code and URL are copies of the real room created by tv.js.
  // Never put a hard-coded demo room code on a playable page.
  function syncJoin(){
    const qr=$('qrImage');
    const src=qr?.getAttribute('src');
    if(src){$('welcomeQR').src=src;$('welcomeQR').hidden=false;}
    else {$('welcomeQR').hidden=true;}
    const code=$('roomCode')?.textContent?.replace(/\s/g,'').trim();
    $('welcomeRoomCode').textContent=code&&code!=='····'?code:'····';
    const url=$('joinUrl')?.textContent;
    $('welcomePhoneUrl').textContent=url&&url!=='Connecting…'?url:'Preparing room…';
  }
  const observer=new MutationObserver(syncJoin);
  for(const id of ['qrImage','roomCode','joinUrl']){
    const el=$(id);if(el)observer.observe(el,{attributes:true,childList:true,subtree:true,characterData:true});
  }
  syncJoin();
})();
