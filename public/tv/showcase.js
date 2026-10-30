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


/* GAME NIGHT cinematic introduction v1.1 — isolated presentation layer.
   Does not intercept socket events, lobby actions, or reconnection. */
(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  // Browser URL APIs are absent in legacy VM test harnesses; leave existing welcome logic alone.
  if (typeof URLSearchParams === 'undefined' || typeof location === 'undefined') return;
  const query = new URLSearchParams(location.search);
  if (query.has('room') || query.has('token') || query.has('playerId') || query.has('reconnect') || query.has('skipIntro')) return;
  try { if (sessionStorage.getItem('gn-noggin-intro-seen') === '1') return; } catch (_) {}
  const overlay = document.createElement('div');
  overlay.className = 'gn-cinema';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Game Night cinematic introduction');
  overlay.innerHTML = '<div class="gn-cinema-actions"><button type="button" class="gn-cinema-mute" aria-label="Toggle introduction sound"></button><button type="button" class="gn-cinema-skip">SKIP INTRO →</button></div><div class="gn-cinema-inner"><div class="gn-cinema-kicker">THE COLLECTION PRESENTS</div><div class="gn-cinema-brand">GAME <span>NIGHT</span></div><div class="gn-cinema-line">YOUR NIGHT. YOUR GAME.</div></div>';
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
      for (const [i, freq] of [392, 493.88, 587.33].entries()) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.045, now + i * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(now + i * 0.1);
        oscillator.stop(now + i * 0.1 + 0.52);
      }
    } catch (_) { /* Optional audio must never prevent gameplay. */ }
  }
  let finished = false;
  let phaseTimer, doneTimer;
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(phaseTimer); clearTimeout(doneTimer);
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
  phaseTimer = setTimeout(() => {
    if (finished) return;
    overlay.classList.add('gn-noggin-phase');
    overlay.querySelector('.gn-cinema-kicker').textContent = 'THE LIVING-ROOM GAME SHOW';
    overlay.querySelector('.gn-cinema-brand').innerHTML = '<img src="/play/art/noggin-logo.webp" alt="NOGGIN">';
    overlay.querySelector('.gn-cinema-line').textContent = 'USE YOUR HEAD. TRUST YOUR NERVE.';
    sting();
  }, 2000);
  doneTimer = setTimeout(finish, 4400);
})();
