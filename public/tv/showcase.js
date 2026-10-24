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

  function goToLobby(focusId) {
    splash.classList.add('welcome-dismissed');
    splash.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => {
      splash.hidden = true;
      $(focusId)?.focus();
    }, 180);
  }

  $('welcomeStart').addEventListener('click', () => goToLobby('target'));
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
    goToLobby('target');
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
