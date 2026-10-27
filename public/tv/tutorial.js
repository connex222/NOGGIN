'use strict';
// HEADSTART — the NOGGIN crash course, played on the TV.
// A self-running, optionally read-aloud slideshow with live mini-board animations.
// Runs entirely in the browser: no room, server or phones needed.
// Controls: ◀ ▶ arrows or Enter (next), Space (pause), Esc (exit), 🔊 (read aloud).
(() => {
  const $ = id => document.getElementById(id);
  const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const store = {get(k) {try {return localStorage.getItem(k);} catch {return null;}}, set(k, v) {try {localStorage.setItem(k, String(v));} catch {}}};

  // Numbers quoted in the tutorial. tests/tutorial.test.js checks every value
  // against the live server rules, so the tutorial can never drift out of date.
  const FACTS = {"hostWin":3,"otherWinner":2,"teamWin":2,"applause":2,"startPass":1,"startLand":2,"showdownTransfer":2,"cornerBonus":1,"underdogThreshold":3,"underdogBonus":1,"underdogBonusEight":2,"buzzerTarget":3,"pickMs":8000,"lobbyHoldMinutes":10,"autoRoundsSmall":12,"autoRoundsLarge":10,"boardSpaces":28};

  // Game names, matched against the server's own game list by the tests.
  const GAMES = {
    speed: [['quick-draw', 'Quick Draw'], ['count-flash', 'Count Flash'], ['odd-spot', 'Odd Spot'], ['colour-clash', 'Colour Clash']],
    brain: [['higher-lower', 'Higher or Lower'], ['memory-lane', 'Memory Lane'], ['close-call', 'Close Call'], ['unscramble', 'Unscramble']],
    create: [['sketch-sabotage', 'Sketch & Sabotage'], ['noise-annoys', 'Noise Annoys'], ['caption-this', 'Caption This'], ['fib-factory', 'Fib Factory']],
    together: [['mind-meld', 'Mind Meld'], ['majority-rules', 'Majority Rules'], ['relay-sums', 'Relay Sums'], ['bomb-squad', 'Bomb Squad']]
  };
  const SHOWDOWNS = [
    ['buzzer', 'Buzzer Battle', `Quiz duel. Fastest buzz answers. First to ${FACTS.buzzerTarget}.`],
    ['tug', 'Tug of Wits', 'Race through quick sums to drag the rope your way.'],
    ['bid', 'Bid to Win', 'Bid how many you can name… then prove it.'],
    ['nerve', 'Nerve', 'A counter climbs. Bank before it secretly bursts.']
  ];
  const CAT = {speed: {label: 'SPEED', icon: '⚡', colour: '#ff667e', blurb: 'Fast fingers and sharp eyes.'},
    brain: {label: 'BRAIN', icon: '◆', colour: '#64aeff', blurb: 'Memory, guessing and puzzles.'},
    create: {label: 'CREATE', icon: '✎', colour: '#ffe477', blurb: 'Drawing, acting and bluffing.'},
    together: {label: 'TOGETHER', icon: '✚', colour: '#9de97c', blurb: 'Team up — or read the room.'}};

  let data = {board: [], avatars: [], howto: {}};
  let loaded = null;
  function load() {
    if (loaded) return loaded;
    const get = (url, fallback) => fetch(url).then(r => (r.ok ? r.json() : fallback)).catch(() => fallback);
    loaded = Promise.all([get('/shared/board-data.json', []), get('/shared/avatars.json', []), get('/shared/howto.json', {})])
      .then(([board, avatars, howto]) => {data = {board, avatars, howto};});
    return loaded;
  }

  // ───────────────────────── little drawing helpers ─────────────────────────
  const el = (tag, cls, text) => {const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e;};
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, text) => {const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e;};
  const avatar = i => data.avatars[i % Math.max(1, data.avatars.length)];
  function face(i, cls = 'ht-face') {
    const img = el('img', cls); img.alt = ''; img.src = avatar(i)?.think || ''; img.onerror = () => {img.style.visibility = 'hidden';};
    return img;
  }
  // The real 28-space trapezium, drawn small. Positions follow server/layout.js.
  function boardPoints() {
    const pts = {}, bottom = [6, 5, 4, 3, 2, 1, 0, 27, 26, 25, 24, 23, 22], top = [10, 11, 12, 13, 14, 15, 16, 17, 18];
    bottom.forEach((s, i) => {pts[s] = [40 + i * (720 / 12), 330];});
    top.forEach((s, i) => {pts[s] = [190 + i * (420 / 8), 70];});
    const side = (from, to, list) => list.forEach((s, i) => {const t = (i + 1) / (list.length + 1); pts[s] = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];});
    side(pts[6], pts[10], [7, 8, 9]); side(pts[22], pts[18], [21, 20, 19]);
    return pts;
  }
  function miniBoard({highlight = null, dim = false} = {}) {
    const svg = svgEl('svg', {viewBox: '0 0 800 400', class: 'ht-board', role: 'img', 'aria-label': `The ${FACTS.boardSpaces}-space NOGGIN board`});
    const pts = boardPoints();
    svg.append(svgEl('polygon', {points: [pts[6], pts[10], pts[18], pts[22]].map(p => p.join(',')).join(' '), class: 'ht-board-track'}));
    for (const space of data.board) {
      const [x, y] = pts[space.index] || [0, 0];
      const on = !highlight || highlight.includes(space.type);
      const g = svgEl('g', {transform: `translate(${x},${y})`, class: `ht-space${on ? '' : ' off'}${dim ? ' dim' : ''}`, 'data-index': space.index});
      g.append(svgEl('rect', {x: -24, y: -24, width: 48, height: 48, rx: 9, fill: space.color}));
      g.append(svgEl('text', {x: 0, y: 8, 'text-anchor': 'middle'}, space.icon));
      svg.append(g);
    }
    svg.points = pts;
    return svg;
  }
  function token(svg, i, space, label) {
    const g = svgEl('g', {class: 'ht-token'});
    const clip = `ht-clip-${i}-${Math.random().toString(36).slice(2)}`;
    const cp = svgEl('clipPath', {id: clip}); cp.append(svgEl('circle', {r: 19})); g.append(cp);
    g.append(svgEl('circle', {r: 22, class: 'ht-token-ring'}));
    g.append(svgEl('image', {href: avatar(i)?.think || '', x: -19, y: -19, width: 38, height: 38, 'clip-path': `url(#${clip})`, preserveAspectRatio: 'xMidYMid slice'}));
    if (label) {const b = svgEl('g', {class: 'ht-call', transform: 'translate(0,32)'}); b.append(svgEl('rect', {x: -26, y: -11, width: 52, height: 21, rx: 10})); b.append(svgEl('text', {x: 0, y: 5, 'text-anchor': 'middle'}, label)); b.style.display = 'none'; g.append(b); g.callBadge = b;}
    g.moveTo = (s, offset = 0) => {const [x, y] = svg.points[s]; g.setAttribute('transform', `translate(${x + offset},${y - 46})`); g.space = s;};
    g.moveTo(space, (i - 1) * 16);
    svg.append(g);
    return g;
  }
  // Hop a token forward one space at a time. Returns a stop function.
  function hop(g, steps, offset, done, delay = 420) {
    if (REDUCED) {g.moveTo((g.space + steps) % FACTS.boardSpaces, offset); done?.(); return () => {};}
    let n = 0;
    const t = setInterval(() => {g.moveTo((g.space + 1) % FACTS.boardSpaces, offset); if (++n >= steps) {clearInterval(t); done?.();}}, delay);
    return () => clearInterval(t);
  }
  function phone(title, buttons = [], note = '') {
    const p = el('div', 'ht-phone');
    p.append(el('div', 'ht-phone-notch'), el('div', 'ht-phone-title', title));
    for (const [text, cls] of buttons) p.append(el('div', `ht-phone-btn ${cls || ''}`, text));
    if (note) p.append(el('div', 'ht-phone-note', note));
    return p;
  }
  const chip = (text, cls = '') => el('div', `ht-chip ${cls}`, text);

  // ───────────────────────── the slides ─────────────────────────
  // Each slide: chapter, title, lines (read aloud in order), and a visual builder
  // that returns an optional cleanup function.
  const SLIDES = [
    {chapter: 'Welcome', title: 'Welcome to HEADSTART', lines: [
      'NOGGIN is a party game show for 2 to 8 players.',
      'The TV is the game board. Your phone is your controller.',
      'Win games, collect Sparks — and the most Sparks at the end wins the show.'],
      visual(stage) {
        const row = el('div', 'ht-cast'); for (let i = 0; i < 6; i++) {const f = face(i); f.style.setProperty('--i', i); row.append(f);}
        const pair = el('div', 'ht-pair');
        pair.append(el('div', 'ht-big-icon', '📺'), el('div', 'ht-plus', '+'), el('div', 'ht-big-icon', '📱'), el('div', 'ht-plus', '='), el('div', 'ht-big-icon spark', '✦'));
        stage.append(row, pair);
      }},
    {chapter: 'Join', title: 'Join in ten seconds', lines: [
      'Start a room on the TV, then everyone scans the QR code with their phone camera.',
      'Type a name, pick a character and tap READY. Nothing to install.',
      'The first person to join is the VIP, who can change settings from their phone.',
      `Phone gone to sleep? Your lobby seat is held for ${FACTS.lobbyHoldMinutes} minutes.`],
      visual(stage) {
        const qr = el('div', 'ht-qr'); for (let i = 0; i < 49; i++) qr.append(el('i', (i * 7919) % 3 ? 'on' : ''));
        const grid = el('div', 'ht-avatar-grid'); for (let i = 0; i < 6; i++) {const f = face(i, 'ht-face small'); if (i === 2) f.classList.add('picked'); grid.append(f);}
        const p = phone('PICK YOUR CHARACTER', [], ''); p.append(grid, el('div', 'ht-phone-btn go pulse', 'READY ✓'));
        stage.append(el('div', 'ht-row', '')); stage.lastChild.append(qr, el('div', 'ht-arrow', '→'), p);
      }},
    {chapter: 'The board', title: 'The board', lines: [
      `${FACTS.boardSpaces} spaces round a stage. Every space does something.`,
      'Coloured spaces call the next game: Speed, Brain, Create or Together.',
      'The four gold corners are Showdowns. The rest are special spaces — more on those soon.'],
      visual(stage) {
        stage.append(miniBoard());
        const legend = el('div', 'ht-legend');
        for (const [, c] of Object.entries(CAT)) {const d = chip(`${c.icon} ${c.label}`); d.style.setProperty('--c', c.colour); legend.append(d);}
        const s = chip('★ SHOWDOWN'); s.style.setProperty('--c', '#ffd168'); legend.append(s);
        stage.append(legend);
      }},
    {chapter: 'Rolling', title: 'Everybody rolls at once', lines: [
      'Each round, everyone taps ROLL on their phone at the same time.',
      'Then the TV moves each token in turn, so nobody misses a thing.',
      'Pass START for a bonus Spark. Land exactly on it for two.'],
      visual(stage) {
        const b = miniBoard(); stage.append(b);
        const tokens = [token(b, 0, 0), token(b, 3, 0), token(b, 5, 0)];
        const stops = []; let k = 0;
        const go = () => {if (k >= tokens.length) return; const t = tokens[k]; stops.push(hop(t, [3, 5, 2][k], (k - 1) * 16, () => {k++; setTimeout(go, 500);}));};
        const dice = el('div', 'ht-dice'); ['⚂', '⚄', '⚁'].forEach(d => dice.append(el('span', '', d))); stage.append(dice);
        setTimeout(go, 600);
        return () => stops.forEach(s => s());
      }},
    {chapter: 'Calling', title: 'Land on a colour, call the game', lines: [
      'Land on a coloured space and you CALL that kind of game for the round — and you host it.',
      'But watch out: a later colour steals the call. The CALL badge shows who has it.',
      'Purple Steal the Call space? You take over hosting, whatever was called.'],
      visual(stage) {
        const b = miniBoard({highlight: ['speed', 'brain', 'create', 'together', 'steal']}); stage.append(b);
        const a = token(b, 1, 0, 'CALL'), c = token(b, 4, 0, 'CALL');
        const line = el('div', 'ht-callout', ''); stage.append(line);
        const stops = [];
        stops.push(hop(a, 2, -10, () => {a.callBadge.style.display = ''; line.textContent = `${avatar(1)?.name || 'Player 1'} calls SPEED!`;
          setTimeout(() => stops.push(hop(c, 1, 10, () => {a.callBadge.style.display = 'none'; c.callBadge.style.display = ''; line.textContent = `${avatar(4)?.name || 'Player 2'} steals the call!`;})), 1200);}));
        return () => stops.forEach(s => s());
      }},
    {chapter: 'Calling', title: 'Caller’s choice', lines: [
      'After everyone has moved, the caller picks one of two games on their phone.',
      `They have ${FACTS.pickMs / 1000} seconds — dither, and the studio picks for them.`,
      'Then everybody plays that game together, at the same time, on their own phone.'],
      visual(stage) {
        const p = phone('PICK THE GAME!', [['▶ QUICK DRAW', 'go'], ['▶ ODD SPOT', 'go']], 'You host whichever you choose');
        const tv = el('div', 'ht-tv'); tv.append(el('div', 'ht-tv-text', '🎮 CALLER PICKS: QUICK DRAW  OR  ODD SPOT'));
        stage.append(el('div', 'ht-row')); stage.lastChild.append(tv, p);
      }},
    ...Object.entries(GAMES).map(([cat, games]) => ({chapter: 'The 16 games', title: `${CAT[cat].icon} ${CAT[cat].label} games`, cat, lines: [
      CAT[cat].blurb, `${games.map(g => g[1]).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`,
      'Every game starts with a quick rules card on the TV, so you never have to remember them.'],
      visual(stage) {
        const grid = el('div', 'ht-games'); grid.style.setProperty('--c', CAT[cat].colour);
        for (const [id, name] of games) {
          const card = el('div', 'ht-game'); card.append(el('h3', '', name));
          // The tutorial teaches Classic (the default), so use Classic wording where it differs.
          const steps = data.howto?.[id]?.classicSteps || data.howto?.[id]?.steps || [];
          const ol = el('ol'); for (const [icon, text] of steps) {const li = el('li'); li.append(el('span', 'ht-step-icon', icon), el('span', '', text)); ol.append(li);}
          card.append(ol); grid.append(card);
        }
        stage.append(grid);
      }})),
    {chapter: 'Scoring', title: 'How you win Sparks', lines: [
      `Win the round game as its host: plus ${FACTS.hostWin}. Win it as anyone else: plus ${FACTS.otherWinner}.`,
      `Team games like Relay Sums and Mind Meld: every winner gets plus ${FACTS.teamWin}.`,
      'A host who finishes dead last loses one Spark — but never when everyone ties.'],
      visual(stage) {
        const g = el('div', 'ht-score-grid');
        for (const [big, small, cls] of [[`+${FACTS.hostWin}`, 'HOST WINS', 'gold'], [`+${FACTS.otherWinner}`, 'ANY OTHER WINNER', ''], [`+${FACTS.teamWin}`, 'EACH TEAM WINNER', 'green'], ['−1', 'HOST FINISHES LAST', 'red']]) {
          const c = el('div', `ht-score ${cls}`); c.append(el('strong', '', big), el('span', '', small)); g.append(c);
        }
        stage.append(g);
      }},
    {chapter: 'Showdowns', title: 'Showdowns: one-on-one', lines: [
      'Land on a gold corner and you start a Showdown. Pick your rival on your phone.',
      `The winner takes up to ${FACTS.showdownTransfer} Sparks from the loser.`,
      `One Showdown per round — land on a corner after that and you get a +${FACTS.cornerBonus} bonus instead.`],
      visual(stage) {
        const g = el('div', 'ht-duels');
        for (const [, name, text] of SHOWDOWNS) {const c = el('div', 'ht-duel'); c.append(el('h3', '', `★ ${name}`), el('p', '', text)); g.append(c);}
        const vs = el('div', 'ht-vs'); vs.append(face(0), el('strong', '', 'VS'), face(7));
        stage.append(vs, g);
      }},
    {chapter: 'Showdowns', title: 'Watching? Pick a winner', lines: [
      'Not in the Showdown? Back a winner on your phone before it starts — it’s free.',
      'In Classic, a correct pick earns a Spark if you’re outside the top two.',
      'In Showtime, it earns a Director’s Cue instead.'],
      visual(stage) {
        const p = phone('SPOTLIGHT PICK', [[`🎬 BACK ${(avatar(0)?.name || 'PLAYER 1').toUpperCase()}`, 'blue'], [`🎬 BACK ${(avatar(7)?.name || 'PLAYER 2').toUpperCase()}`, 'blue']], 'Free to play · no Sparks at risk');
        const crowd = el('div', 'ht-cast small'); for (let i = 1; i < 6; i++) crowd.append(face(i));
        stage.append(crowd, p);
      }},
    {chapter: 'Special spaces', title: 'Special spaces', lines: [
      'Applause and Start pay out Sparks. Pickpocket steals one from the leader.',
      'Brain Drain costs you a Spark. The Stage Lift whisks you across the board.',
      'Wildcard lets you choose the round’s game and lock it so nobody can steal it.'],
      visual(stage) {
        const items = [['applause', `+${FACTS.applause} Sparks`], ['start', `Pass +${FACTS.startPass} · land +${FACTS.startLand}`], ['pickpocket', 'Steal 1 from the leader'], ['drain', 'Lose 1 Spark'], ['lift', 'Jump to the other lift'], ['wildcard', 'Pick, lock and host the game'], ['steal', 'You host this round'], ['showdown', 'Challenge a rival']];
        const g = el('div', 'ht-spaces');
        for (const [type, text] of items) {
          const s = data.board.find(x => x.type === type) || {};
          const c = el('div', 'ht-space-card'); const ic = el('span', 'ht-space-icon', s.icon || '•'); ic.style.background = s.color || '#888';
          c.append(ic, el('strong', '', type === 'showdown' ? 'Showdown corner' : s.label || type), el('small', '', text)); g.append(c);
        }
        stage.append(g);
      }},
    {chapter: 'Catching up', title: 'Nobody gets left behind', lines: [
      `Win a game while ${FACTS.underdogThreshold} or more Sparks behind the leader and the Underdog Rule adds a bonus Spark (two in an eight-player game).`,
      'In the last three rounds, your phone shows exactly how far behind you are.',
      'So keep going — the last round can change everything.'],
      visual(stage) {
        const p = phone('YOUR TURN', [['🎲 ROLL', 'go']], '');
        p.insertBefore(el('div', 'ht-gap', 'You’re 4 behind — Last Orders doubles everything.'), p.children[2]);
        const u = el('div', 'ht-underdog'); u.append(face(5), el('strong', '', `UNDERDOG +${FACTS.underdogBonus}`));
        stage.append(el('div', 'ht-row')); stage.lastChild.append(u, p);
      }},
    {chapter: 'The finale', title: 'Last Orders', lines: [
      'The final round is called Last Orders.',
      'Every Spark you win in it is doubled.',
      'The TV shows the standings first — last place can still win this.'],
      visual(stage) {
        const box = el('div', 'ht-standings'); const head = el('h3', '', '🍺 LAST ORDERS · THE STANDINGS '); head.append(el('span', 'ht-double', '×2')); box.append(head);
        const ol = el('ol'); [9, 7, 6, 4].forEach((n, i) => {const li = el('li'); li.append(face(i * 2), el('span', '', avatar(i * 2)?.name || `Player ${i + 1}`), el('strong', '', `✦ ${n}`)); ol.append(li);});
        box.append(ol);
        stage.append(box);
      }},
    {chapter: 'The finale', title: 'Crowning the winner', lines: [
      'When the final round ends, the most Sparks wins NOGGIN.',
      'A tie at the top? It goes to a Noggin-Off: one number question, closest guess wins.',
      'Still tied after one replay? The first answer in takes the crown.'],
      visual(stage) {
        const w = el('div', 'ht-winner'); w.append(el('div', 'ht-crown', '👑'), face(3, 'ht-face huge'), el('strong', '', `${(avatar(3)?.name || 'Player').toUpperCase()} WINS NOGGIN!`));
        stage.append(w);
      }},
    {chapter: 'Good to know', title: 'Handy house rules', lines: [
      'Keep the NOGGIN page open on your phone. If it drops out, just reopen it — you go straight back to your seat.',
      'Colour-blind safe mode swaps Colour Clash for Shape Clash. Relaxed timers give everyone more time.',
      `Shows last ${FACTS.autoRoundsSmall} rounds with up to five players, or ${FACTS.autoRoundsLarge} with more.`],
      visual(stage) {
        const g = el('div', 'ht-tips');
        for (const [icon, text] of [['📱', 'Keep the page open'], ['🔁', 'Dropped out? Just reopen'], ['🔷', 'Colour-blind safe mode'], ['🐢', 'Relaxed timers'], ['👑', 'First to join is the VIP'], ['🔇', 'Sound button on the TV']]) {
          const t = el('div', 'ht-tip'); t.append(el('span', '', icon), el('strong', '', text)); g.append(t);
        }
        stage.append(g);
      }},
    {chapter: 'Ready', title: 'You’ve got a HEADSTART', lines: [
      'That’s everything. The TV will guide you through the rest as you play.',
      'Grab your phones, find a comfy seat — and use your head!'],
      finale: true,
      visual(stage) {
        const row = el('div', 'ht-cast'); for (let i = 0; i < 8; i++) {const f = face(i); f.style.setProperty('--i', i); row.append(f);}
        const actions = el('div', 'ht-final-actions');
        const start = el('button', 'ht-btn primary', '▶ START A ROOM'); start.type = 'button'; start.id = 'htStartRoom';
        const again = el('button', 'ht-btn', '↺ WATCH AGAIN'); again.type = 'button'; again.id = 'htAgain';
        start.onclick = () => {close(); document.getElementById('welcomeStart')?.click();};
        again.onclick = () => show(0);
        actions.append(start, again);
        stage.append(row, actions);
      }}
  ];

  // ───────────────────────── the player ─────────────────────────
  let root = null, index = 0, playing = true, timer = null, cleanup = null, startedAt = 0, duration = 0, opener = null, raf = null;
  // Premium Creative Claw narration for each of the 19 tutorial scenes.
  const NARRATION = ["/audio/tutorial/scene-01.mp3","/audio/tutorial/scene-02.mp3","/audio/tutorial/scene-03.mp3","/audio/tutorial/scene-04.mp3","/audio/tutorial/scene-05.mp3","/audio/tutorial/scene-06.mp3","/audio/tutorial/scene-07.mp3","/audio/tutorial/scene-08.mp3","/audio/tutorial/scene-09.mp3","/audio/tutorial/scene-10.mp3","/audio/tutorial/scene-11.mp3","/audio/tutorial/scene-12.mp3","/audio/tutorial/scene-13.mp3","/audio/tutorial/scene-14.mp3","/audio/tutorial/scene-15.mp3","/audio/tutorial/scene-16.mp3","/audio/tutorial/scene-17.mp3","/audio/tutorial/scene-18.mp3","/audio/tutorial/scene-19.mp3"];
  let activeAudio = null, audioSlide = -1, speechSequence = 0;
  let readAloud = store.get('noggin-headstart-voice') !== 'false';
  const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';

  function build() {
    root = el('section', 'headstart'); root.id = 'headstart'; root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'HEADSTART — how to play NOGGIN');
    root.innerHTML = `
      <header class="ht-head">
        <div class="ht-brand"><strong>HEADSTART</strong><span>the NOGGIN crash course</span></div>
        <div class="ht-chapter" id="htChapter"></div>
        <button type="button" class="ht-btn ghost" id="htExit" aria-label="Exit the tutorial">✕ EXIT</button>
      </header>
      <main class="ht-main">
        <div class="ht-stage" id="htStage" aria-hidden="true"></div>
        <div class="ht-copy"><h2 id="htTitle"></h2><ul id="htLines" aria-live="polite"></ul></div>
      </main>
      <footer class="ht-foot">
        <div class="ht-progress"><i id="htBar"></i></div>
        <div class="ht-controls">
          <button type="button" class="ht-btn" id="htBack" aria-label="Previous slide">◀ BACK</button>
          <button type="button" class="ht-btn" id="htPlay" aria-label="Pause">⏸ PAUSE</button>
          <button type="button" class="ht-btn primary" id="htNext" aria-label="Next slide">NEXT ▶</button>
          <button type="button" class="ht-btn ghost" id="htVoice"></button>
          <div class="ht-dots" id="htDots"></div>
        </div>
      </footer>`;
    document.body.append(root);
    $('htExit').onclick = close; $('htBack').onclick = () => show(index - 1); $('htNext').onclick = () => show(index + 1);
    $('htPlay').onclick = () => setPlaying(!playing);
    $('htVoice').onclick = () => {readAloud = !readAloud; store.set('noggin-headstart-voice', readAloud); voiceLabel(); stopSpeech(); if (playing) schedule();};
    const dots = $('htDots');
    SLIDES.forEach((s, i) => {const d = el('button', 'ht-dot'); d.type = 'button'; d.setAttribute('aria-label', `Slide ${i + 1}: ${s.title}`); d.onclick = () => show(i); dots.append(d);});
    root.addEventListener('keydown', onKey);
    voiceLabel();
  }
  function voiceLabel() {const b = $('htVoice'); b.textContent = readAloud ? '🔊 READ ALOUD: ON' : '🔈 READ ALOUD: OFF'; b.setAttribute('aria-pressed', String(readAloud));}
  function onKey(e) {
    const k = e.key;
    if (['ArrowRight', 'PageDown', 'MediaTrackNext'].includes(k) || (k === 'Enter' && e.target === root)) {e.preventDefault(); show(index + 1);}
    else if (['ArrowLeft', 'PageUp', 'MediaTrackPrevious'].includes(k)) {e.preventDefault(); show(index - 1);}
    else if ([' ', 'MediaPlayPause', 'k'].includes(k) && !['BUTTON'].includes(e.target.tagName)) {e.preventDefault(); setPlaying(!playing);}
    else if (k === 'Escape' || k === 'BrowserBack') {e.preventDefault(); close();}
    else if (k === 'Home') {e.preventDefault(); show(0);}
    else if (k === 'Tab') {
      // Keep keyboard focus inside the tutorial.
      const f = [...root.querySelectorAll('button:not([hidden])')].filter(b => b.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {e.preventDefault(); f.at(-1).focus();}
      else if (!e.shiftKey && document.activeElement === f.at(-1)) {e.preventDefault(); f[0].focus();}
    }
  }
  function stopSpeech() {
    speechSequence++;
    if (activeAudio) { activeAudio.onended = null; activeAudio.onerror = null; activeAudio.pause(); activeAudio = null; }
    audioSlide = -1;
    if (canSpeak) try { speechSynthesis.cancel(); } catch {}
  }
  function speak(text, onEnd) {
    if (!canSpeak || !readAloud) return false;
    try { speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find(v => /en-GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || null;
    u.lang = u.voice?.lang || 'en-GB'; u.rate = 1; u.pitch = 1;
    u.onend = () => onEnd?.(); u.onerror = () => onEnd?.();
    try { speechSynthesis.speak(u); return true; } catch { return false; }
  }
  function slideSeconds(slide) {
    const words = (slide.title + ' ' + slide.lines.join(' ')).split(/\\s+/).length;
    return Math.max(9, Math.round(words / 2.6) + 3);
  }
  function reportNarration(message) { const b = $('htVoice'); if (b && readAloud) { b.textContent = message; b.title = message; } }
  function schedule() {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    const slide = SLIDES[index];
    if (!slide || slide.finale) { $('htBar').style.width = '100%'; return; }
    duration = slideSeconds(slide) * 1000;
    startedAt = performance.now();
    const seq = ++speechSequence;
    const advance = () => {
      if (!playing || seq !== speechSequence || SLIDES[index] !== slide) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (playing && seq === speechSequence) show(index + 1);
      }, 1200);
    };
    if (playing && readAloud) {
      const resume = activeAudio && audioSlide === index;
      if (!resume) {
        if (activeAudio) { activeAudio.pause(); activeAudio = null; }
        const audio = new Audio(NARRATION[index]);
        activeAudio = audio;
        audioSlide = index;
      }
      const audio = activeAudio;
      audio.onplaying = () => { if (seq === speechSequence) reportNarration('🔊 STUDIO NARRATION · DAN'); };
      audio.onended = advance;
      audio.onerror = () => {
        if (!playing || seq !== speechSequence || activeAudio !== audio) return;
        activeAudio = null; audioSlide = -1;
        reportNarration('⚠ STUDIO AUDIO UNAVAILABLE · DEVICE VOICE');
        if (!speak(slide.title + '. ' + slide.lines.join(' '), advance)) {
          timer = setTimeout(() => { if (playing && seq === speechSequence) show(index + 1); }, duration);
        }
      };
      audio.play().catch(() => { if (seq === speechSequence) audio.onerror?.(); });
    } else if (playing) {
      timer = setTimeout(() => { if (playing && seq === speechSequence) show(index + 1); }, duration);
    }
    const tick = () => {
      if (!playing || seq !== speechSequence) return;
      const audio = activeAudio;
      const position = audio && Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.currentTime / audio.duration : (performance.now() - startedAt) / duration;
      $('htBar').style.width = Math.round(Math.min(1, Math.max(0, position)) * 100) + '%';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    playing = on;
    const b = $('htPlay'); b.textContent = on ? '⏸ PAUSE' : '▶ PLAY'; b.setAttribute('aria-label', on ? 'Pause' : 'Play');
    if (on) schedule(); else {clearTimeout(timer); cancelAnimationFrame(raf); speechSequence++; if (activeAudio) activeAudio.pause(); if (canSpeak) try {speechSynthesis.cancel();} catch {}}
  }
  function show(i) {
    if (!root) return;
    index = Math.max(0, Math.min(SLIDES.length - 1, i));
    const s = SLIDES[index];
    try {cleanup?.();} catch {} cleanup = null;
    stopSpeech();
    $('htChapter').textContent = `${index + 1} / ${SLIDES.length} · ${s.chapter.toUpperCase()}`;
    $('htTitle').textContent = s.title;
    const lines = $('htLines'); lines.replaceChildren();
    s.lines.forEach((t, n) => {const li = el('li', '', t); li.style.setProperty('--n', n); lines.append(li);});
    const stage = $('htStage'); stage.replaceChildren(); stage.dataset.cat = s.cat || '';
    try {cleanup = s.visual(stage) || null;} catch (err) {console.warn('HEADSTART visual failed', err);}
    [...$('htDots').children].forEach((d, n) => d.classList.toggle('on', n === index));
    $('htBack').disabled = index === 0;
    $('htNext').hidden = Boolean(s.finale);
    root.classList.remove('ht-enter'); void root.offsetWidth; root.classList.add('ht-enter');
    $('htBar').style.width = '0%';
    schedule();
    if (s.finale) setTimeout(() => $('htStartRoom')?.focus(), 50);
  }
  async function open() {
    if (!root) build();
    opener = document.activeElement;
    await load();
    root.hidden = false; document.body.classList.add('headstart-open');
    playing = true; show(0);
    $('htNext').focus();
  }
  function close() {
    if (!root || root.hidden) return;
    clearTimeout(timer); cancelAnimationFrame(raf); stopSpeech();
    try {cleanup?.();} catch {} cleanup = null;
    root.hidden = true; document.body.classList.remove('headstart-open');
    opener?.focus?.();
  }

  window.NogginHeadstart = {open, close, slides: SLIDES, facts: FACTS, games: GAMES};
  document.addEventListener('DOMContentLoaded', wire);
  if (document.readyState !== 'loading') wire();
  function wire() {
    for (const id of ['welcomeHeadstart', 'rulesHeadstart']) {
      const b = $(id); if (!b || b.dataset.wired) continue;
      b.dataset.wired = '1';
      b.addEventListener('click', () => {const d = $('welcomeRulesDialog'); if (d && !d.hidden) d.hidden = true; open();});
    }
  }
})();
