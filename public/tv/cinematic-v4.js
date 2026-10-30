/* NOGGIN Broadcast V4 — photographically rendered scenes (isolated from game networking) */
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (typeof URLSearchParams === 'undefined' || typeof location === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const query = new URLSearchParams(location.search);
  if (['room','token','playerId','reconnect','skipIntro'].some(key => query.has(key))) return;
  try { if (sessionStorage.getItem('gn-noggin-intro-seen') === '1') return; } catch (_) {}
  const root = document.createElement('div');
  root.className = 'gn-v4'; root.setAttribute('role','dialog'); root.setAttribute('aria-label','NOGGIN television introduction');
  root.innerHTML = `<div class="gn-v4-image gn-v4-image-a"></div><div class="gn-v4-image gn-v4-image-b"></div>
    <div class="gn-v4-shade"></div>
    <div class="gn-v4-controls"><button class="gn-v4-mute" type="button" aria-label="Toggle introduction sound">SOUND OFF</button><button class="gn-v4-skip" type="button">SKIP INTRO</button></div>
    <div class="gn-v4-title"><div class="gn-v4-eyebrow">AN ORIGINAL GAME NIGHT PRODUCTION</div><strong>GAME <span>NIGHT</span></strong></div>
    <div class="gn-v4-logo"><img src="/play/art/noggin-logo.webp" alt="NOGGIN"></div>
    <div class="gn-v4-tagline">USE YOUR HEAD. TRUST YOUR NERVE.</div>
    <div class="gn-v4-progress"><div></div></div>`;
  document.body.appendChild(root);
  const imgA=root.querySelector('.gn-v4-image-a'), imgB=root.querySelector('.gn-v4-image-b');
  let active=imgA;
  let muted=true;
  try { muted=localStorage.getItem('gn-intro-muted')!=='false'; } catch (_) {}
  const muteBtn=root.querySelector('.gn-v4-mute');
  const setMute=()=>{muteBtn.textContent=muted?'SOUND OFF':'SOUND ON';muteBtn.setAttribute('aria-pressed',String(!muted));};
  setMute();
  let ctx;
  function sound() {
    if (muted) return;
    try {
      const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
      if (!AudioContextCtor) return;
      ctx ||= new AudioContextCtor();
      if (ctx.state==='suspended') ctx.resume().catch(()=>{});
      const start=ctx.currentTime;
      for (const [i,freq] of [196,294,392].entries()) {
        const o=ctx.createOscillator(), g=ctx.createGain();o.type='sine';o.frequency.value=freq;
        g.gain.setValueAtTime(.0001,start+i*.13);g.gain.exponentialRampToValueAtTime(.035,start+i*.13+.07);
        g.gain.exponentialRampToValueAtTime(.0001,start+i*.13+.9);o.connect(g);g.connect(ctx.destination);
        o.start(start+i*.13);o.stop(start+i*.13+1);
      }
    } catch (_) { /* Audio is optional and cannot interrupt a game */ }
  }
  let ended=false;const handles=[];
  function show(n,scene){
    if(ended)return;
    const next=active===imgA?imgB:imgA;
    next.style.backgroundImage=`url('/tv/cinematic-v4/scene-${String(n).padStart(2,'0')}.jpg')`;
    next.style.opacity='1';next.style.transform='scale(1.02)';
    active.style.opacity='0';active.style.transform='scale(1.09)';active=next;
    root.dataset.scene=scene;
  }
  function end() {
    if(ended)return; ended=true;
    handles.forEach(clearTimeout);
    try {sessionStorage.setItem('gn-noggin-intro-seen','1')}catch(_){}
    root.classList.add('gn-v4-done');
    setTimeout(()=>root.remove(),350);
  }
  function schedule(t,fn){handles.push(setTimeout(()=>{if(!ended)fn()},t));}
  root.querySelector('.gn-v4-skip').addEventListener('click',end);
  muteBtn.addEventListener('click',()=>{muted=!muted;try{localStorage.setItem('gn-intro-muted',String(muted))}catch(_){}setMute();sound()});
  root.addEventListener('keydown',event=>{if(event.key==='Escape')end()});
  root.querySelector('.gn-v4-skip').focus({preventScroll:true});
  // Frames are cut directly from the approved studio storyboard; real approved logo is overlaid at the reveal.
  show(1,'lights');
  schedule(1000,()=>show(2,'studio'));
  schedule(3000,()=>{show(3,'brand');sound()});
  schedule(6000,()=>show(4,'audience'));
  schedule(8000,()=>show(5,'forming'));
  schedule(9500,()=>{show(6,'logo');sound()});
  schedule(12000,()=>show(7,'tagline'));
  schedule(14000,()=>show(8,'lobby'));
  schedule(15000,end);
})();
