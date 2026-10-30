'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const splash = $('welcomeScreen');
  if (!splash) return;

  const expressions = ['think', 'win', 'lose'];
  const expressionNames = {
    think: 'thinking',
    win: 'celebrating',
    lose: 'surprised'
  };

  // Render the same randomly chosen cast on both opening screens.
  fetch('/shared/avatars.json', {cache: 'no-cache'})
    .then(response => {
      if (!response.ok) throw Error('Avatar catalogue missing');
      return response.json();
    })
    .then(avatars => {
      const choices = avatars.map(avatar => ({
        avatar,
        expression: expressions[Math.floor(Math.random() * expressions.length)]
      }));

      for (const id of ['welcomeCast', 'lobbyCast']) {
        const host = $(id);
        if (!host) continue;

        const nodes = document.createDocumentFragment();
        for (const {avatar, expression} of choices) {
          const frame = document.createElement('span');
          frame.className = 'showcase-cast-frame';
          const image = document.createElement('img');
          image.src = avatar.images[expression];
          image.alt = `${avatar.name} ${expressionNames[expression]}`;
          image.width = 112;
          image.height = 164;
          image.loading = 'eager';
          image.onerror = () => {
            image.onerror = null;
            image.src = avatar.think;
          };
          frame.append(image);
          nodes.append(frame);
        }
        host.replaceChildren(nodes);
      }
    })
    .catch(() => {
      for (const id of ['welcomeCast', 'lobbyCast']) {
        const host = $(id);
        if (host) host.textContent = '';
      }
    });

  // D17: there is no #target element. "Start" focuses the START button when it is
  // usable, otherwise the room code (made focusable for this).
  function startFocusId() {
    const ready = $('stageReady');
    if (ready && !ready.disabled) return 'stageReady';
    const code = $('roomCode'); if (code) code.tabIndex = -1;
    return 'roomCode';
  }
  function goToLobby(focusId) {
    splash.classList.add('welcome-dismissed');
    splash.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => {
      splash.hidden = true;
      $(focusId === 'start' ? startFocusId() : focusId)?.focus();
    }, 180);
  }

  $('welcomeStart').addEventListener('click', () => goToLobby('start'));
  $('welcomeJoin').addEventListener('click', () => goToLobby('roomCode'));

  const rules = $('welcomeRulesDialog');
  $('welcomeHowTo').addEventListener('click', () => {
    rules.hidden = false;
    $('welcomeRulesClose').focus();
  });

  function closeRules() {
    rules.hidden = true;
    $('welcomeHowTo').focus();
  }

  $('welcomeRulesClose').addEventListener('click', closeRules);
  rules.addEventListener('click', event => {
    if (event.target === rules) closeRules();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !rules.hidden) closeRules();
  });
  $('welcomeRulesPlay').addEventListener('click', () => {
    rules.hidden = true;
    goToLobby('start');
  });

  // These values mirror the active TV room, never a hard-coded example room.
  function syncJoin() {
    const qr = $('qrImage');
    const src = qr?.getAttribute('src');
    if (src) {
      $('welcomeQR').src = src;
      $('welcomeQR').hidden = false;
    } else {
      $('welcomeQR').hidden = true;
    }

    const code = $('roomCode')?.textContent?.replace(/\s/g, '').trim();
    $('welcomeRoomCode').textContent = code && code !== '····' ? code : '····';

    const url = $('joinUrl')?.textContent;
    $('welcomePhoneUrl').textContent = url && url !== 'Connecting…'
      ? url
      : 'Preparing room…';
  }

  const observer = new MutationObserver(syncJoin);
  for (const id of ['qrImage', 'roomCode', 'joinUrl']) {
    const element = $(id);
    if (element) {
      observer.observe(element, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }
  syncJoin();
})();


/* GAME NIGHT cinematic introduction v3.0: 15-second studio broadcast sequence.
   Isolated from the room, QR, gameplay, and reconnection layers. */
(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof URLSearchParams === 'undefined' || typeof location === 'undefined') return;
  const query = new URLSearchParams(location.search);
  if (query.has('room') || query.has('token') || query.has('playerId') || query.has('reconnect') || query.has('skipIntro')) return;
  try { if (sessionStorage.getItem('gn-noggin-intro-seen') === '1') return; } catch (_) {}
  const overlay = document.createElement('div');
  overlay.className = 'gn-cinema gn-v3 gn-scene-0';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Game Night cinematic introduction');
  overlay.innerHTML = '<div class="gn-studio" aria-hidden="true"></div><div class="gn-v3-shade" aria-hidden="true"></div><div class="gn-v3-lights" aria-hidden="true"></div><div class="gn-cinema-actions"><button type="button" class="gn-cinema-mute" aria-label="Toggle introduction sound"></button><button type="button" class="gn-cinema-skip">SKIP INTRO →</button></div><div class="gn-cinema-inner"><p class="gn-cinema-edition">AN ORIGINAL GAME NIGHT PRODUCTION</p><div class="gn-cinema-kicker">THE COLLECTION PRESENTS</div><div class="gn-cinema-brand">GAME <span>NIGHT</span></div><div class="gn-cinema-rule" aria-hidden="true"></div><div class="gn-cinema-line">YOUR NIGHT. YOUR GAME.</div></div><div class="gn-cinema-progress" aria-hidden="true"></div>';
  document.body.appendChild(overlay);
  const muteButton = overlay.querySelector('.gn-cinema-mute');
  let muted = true;
  try { muted = localStorage.getItem('gn-intro-muted') !== 'false'; } catch (_) {}
  let ctx = null;
  function setMute() {
    muteButton.textContent = muted ? '🔇 SOUND OFF' : '🔊 SOUND ON';
    muteButton.setAttribute('aria-pressed', String(!muted));
  }
  setMute();
  function sting() {
    if (muted) return;
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      ctx ||= new AudioContextCtor();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      // Restrained three-note ident: sound remains optional and silent by default.
      for (const [i, freq] of [196, 294, 392].entries()) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.13);
        gain.gain.linearRampToValueAtTime(0.032, now + i * 0.13 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.13 + 0.9);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(now + i * 0.13);
        oscillator.stop(now + i * 0.13 + 0.92);
      }
    } catch (_) { /* Optional audio must never prevent gameplay. */ }
  }
  let finished = false;
  let phaseTimer, doneTimer;
  const stageTimers = [];
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(phaseTimer); clearTimeout(doneTimer);
    for (const timer of stageTimers) clearTimeout(timer);
    try { sessionStorage.setItem('gn-noggin-intro-seen', '1'); } catch (_) {}
    overlay.remove();
  }
  muteButton.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem('gn-intro-muted', String(muted)); } catch (_) {}
    setMute(); sting();
  });
  overlay.querySelector('.gn-cinema-skip').addEventListener('click', finish);
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') finish(); });
  overlay.querySelector('.gn-cinema-skip').focus({preventScroll:true});
  const stage = (at, number, action) => stageTimers.push(setTimeout(() => {
    if (finished) return;
    overlay.className = 'gn-cinema gn-v3 gn-scene-' + number;
    action?.();
  }, at));
  stage(1000, 1);
  stage(3000, 2);
  stage(6000, 3);
  phaseTimer = setTimeout(() => {
    if (finished) return;
    overlay.className = 'gn-cinema gn-v3 gn-scene-4 gn-noggin-phase';
    overlay.querySelector('.gn-cinema-kicker').textContent = 'THE SHOW BEGINS';
    overlay.querySelector('.gn-cinema-brand').innerHTML = '<img src="/play/art/noggin-logo.webp" alt="NOGGIN">';
    overlay.querySelector('.gn-cinema-line').textContent = '';
    sting();
  }, 9500);
  stage(12000, 5, () => {
    overlay.classList.add('gn-noggin-phase');
    overlay.querySelector('.gn-cinema-line').textContent = 'USE YOUR HEAD. TRUST YOUR NERVE.';
  });
  stage(14000, 6, () => { overlay.classList.add('gn-noggin-phase'); });
  doneTimer = setTimeout(finish, 15000);
})();
