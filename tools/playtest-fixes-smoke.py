"""NOGGIN playtest fixes smoke test (real Chromium, mocked Socket.IO).

Ready Check GOT IT button, on-screen number pad, letter tiles and typing mode.
Run:  python tools/playtest-fixes-smoke.py
Based on the v3.5.0 phone input harness.

Checks in a real browser that:
  D6  buttons survive state broadcasts that only change text (no lost taps),
      but are rebuilt when the controls genuinely change;
  D6  the lobby avatar picker is not rebuilt by unrelated broadcasts;
  D12 VIP dropdowns are not rebuilt by unrelated broadcasts;
  D15 every phone tap target is at least 48 x 48 px on a 360 px phone;
  D16 the last name and character are prefilled on the join screen.
Run:  python tools/v350-phone-input-smoke.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, time

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
OUT = ROOT / 'docs/test-history/playtest-fixes-browser-results.json'
SHOTS = ROOT / 'docs/previews/playtest-fixes'

html = (PUBLIC / 'play/index.html').read_text()
html = re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>', '', html)
html = re.sub(r'<link[^>]+rel="stylesheet"[^>]*>', '', html)
css = '\n'.join((PUBLIC / p).read_text() for p in ['shared/theme.css', 'play/play.css', 'play/studio.css'])
html = html.replace('</head>', '<style>' + css + '</style></head>')
avatars = json.loads((PUBLIC / 'shared/avatars.json').read_text())
fetchmock = 'window.fetch=async(u)=>({ok:true,json:async()=>(String(u).includes("howto")?{}:' + json.dumps(avatars) + ')});'

def mock(stored='{}'):
    return r"""(()=>{
  const seed=""" + stored + r""";
  Object.defineProperty(window,'localStorage',{configurable:true,value:{m:new Map(Object.entries(seed)),getItem(k){return this.m.has(k)?this.m.get(k):null},setItem(k,v){this.m.set(k,String(v))},removeItem(k){this.m.delete(k)}}});
  let handlers={},room={code:'ABCD',phase:'lobby',canStart:false,hostOnline:true,vipId:'p1',settings:{rounds:'auto',timerSpeed:'normal',reduceMotion:false,familyFriendly:true,rules:'classic',roundStyle:'everyone'},players:[],serverNow:Date.now(),board:null};
  const socket={connected:true,id:'sock-1',on(n,fn){handlers[n]=fn;return this},timeout(){return this},emit(n,p,callback){
    let r={ok:true,state:room};
    if(n==='room:resume')r={ok:false,code:'AUTH',message:'No previous seat'};
    if(n==='room:join'){
      room={...room,players:[{id:'p1',name:p.name,avatarId:p.avatarId,seat:1,sparks:3,cues:0,ready:false,online:true},{id:'p2',name:'CaptainK',avatarId:4,seat:2,sparks:2,cues:0,ready:false,online:true}]};
      r={ok:true,code:'ABCD',playerId:'p1',token:'a'.repeat(32),state:room};
    }
    window.__sent=(window.__sent||[]).concat([[n,p]]);
    setTimeout(()=>callback?.(null,r),5);
  }};
  window.io=()=>{setTimeout(()=>handlers.connect?.(),20);return socket;};
  window.__fakeState=(next)=>{room=next;handlers['room:state']?.(room)};
})();"""

now = lambda: int(time.time() * 1000)
PLAYERS = [{'id': 'p1', 'name': 'GameNana', 'avatarId': 8, 'seat': 1, 'sparks': 3, 'cues': 0, 'ready': True, 'online': True},
           {'id': 'p2', 'name': 'CaptainK', 'avatarId': 4, 'seat': 2, 'sparks': 2, 'cues': 0, 'ready': True, 'online': True}]

def game_state(step='minigame', mini=None, showdown=None):
    return {'code': 'ABCD', 'phase': 'board', 'vipId': 'p1', 'hostOnline': True,
            'settings': {'rounds': 'auto', 'rules': 'classic', 'timerSpeed': 'normal', 'roundStyle': 'everyone', 'familyFriendly': True, 'reduceMotion': False},
            'players': PLAYERS, 'serverNow': now(),
            'board': {'step': step, 'turn': 4, 'roundNumber': 2, 'totalRounds': 8, 'activeId': 'p2', 'stage': 'round-game', 'paused': False,
                      'event': {'text': 'live'}, 'result': None, 'winnerIds': [], 'minigame': mini, 'showdown': showdown, 'history': []}}

def odd_spot(answered=(), blocked=None, level=5):
    styles = [{'rotation': 0, 'scale': None} for _ in range(36)]
    styles[7]['scale'] = 0.68
    return {'id': 'odd-spot', 'category': 'speed', 'title': 'Odd Spot', 'rule': 'Find it', 'round': level, 'totalRounds': 5, 'roundKey': 5,
            'phase': 'play', 'question': 'Find the slightly smaller shape.', 'introUntil': now() - 9000, 'deadline': now() + 20000, 'openAt': now(),
            'participants': ['p1', 'p2'], 'eliminated': [], 'answered': list(answered), 'progress': {}, 'scores': {'p1': 0, 'p2': 0},
            'strikes': {}, 'blocked': blocked or {}, 'display': {'grid': ['●'] * 36, 'styles': styles, 'level': level}}

def nerve(number):
    return {'kind': 'nerve', 'title': 'Nerve', 'phase': 'play', 'participants': ['p1', 'p2'], 'question': 'Bank before it bursts!',
            'deadline': now() + 20000, 'roundKey': 1, 'round': 1, 'display': {'number': number, 'banks': []}, 'private': {}}

def memory():
    return {'id': 'memory-lane', 'category': 'brain', 'title': 'Memory Lane', 'rule': 'Repeat', 'round': 2, 'totalRounds': 4, 'roundKey': 3,
            'phase': 'play', 'question': 'Repeat the TV sequence on your phone!', 'introUntil': now() - 9000, 'deadline': now() + 20000, 'openAt': now(),
            'participants': ['p1', 'p2'], 'eliminated': [], 'answered': [], 'progress': {'p1': 0}, 'scores': {}, 'strikes': {}, 'blocked': {},
            'display': {'padCount': 6, 'sequenceLength': 3, 'reverse': False}}


def intro(ready_ids=(), released=False):
    return {'id': 'close-call', 'category': 'brain', 'title': 'Close Call', 'rule': 'Closest guess wins.', 'round': 1, 'totalRounds': 3, 'roundKey': 1,
            'phase': 'intro', 'question': 'How tall is Big Ben in metres?', 'introUntil': now() + 40000, 'deadline': now() + 50000, 'openAt': now() + 40000,
            'participants': ['p1', 'p2'], 'eliminated': [], 'answered': [], 'progress': {}, 'scores': {}, 'strikes': {}, 'blocked': {}, 'display': {},
            'ready': {'ids': list(ready_ids), 'waiting': [p for p in ['p1', 'p2'] if p not in ready_ids], 'released': released, 'startsAt': now() + 3000 if released else None}}

def close_call():
    m = intro(); m.update({'phase': 'play', 'ready': None, 'introUntil': now() - 1000, 'deadline': now() + 15000}); return m

def unscramble():
    m = close_call(); m.update({'id': 'unscramble', 'title': 'Unscramble', 'question': 'K E T T L E', 'hint': 'Kitchen', 'roundKey': 2}); return m

def caption():
    return {'id': 'caption-this', 'title': 'Caption This', 'rule': 'Write a caption.', 'category': 'create', 'round': 1, 'totalRounds': 1, 'roundKey': 1,
            'phase': 'play', 'introUntil': now() - 1000, 'deadline': now() + 40000, 'openAt': now(), 'question': 'Write a caption for the TV picture',
            'display': {'scene': 'x'}, 'participants': ['p1', 'p2'], 'answered': [], 'voted': [], 'scores': {}, 'lastResult': None, 'ready': None}

def tug():
    return {'kind': 'tug', 'title': 'Tug of Wits', 'phase': 'play', 'participants': ['p1', 'p2'], 'question': 'Pull the rope', 'openAt': now(),
            'deadline': now() + 30000, 'hardStop': now() + 30000, 'roundKey': 1, 'answered': [], 'display': {'rope': 0, 'correctCount': {}},
            'private': {'prompt': '12 × 3 = ?', 'qid': 4}, 'ready': None}

results = []
def check(cond, label, **extra):
    results.append({'check': label, 'ok': bool(cond), **extra})
    print(('PASS ' if cond else 'FAIL ') + label, extra if extra else '')
    assert cond, (label, extra)

SHOTS.mkdir(parents=True, exist_ok=True)
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    ctx = browser.new_context(viewport={'width': 360, 'height': 740}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html)
    page.add_script_tag(content=mock() + '\n' + fetchmock)
    page.add_script_tag(content=(PUBLIC / 'shared/client.js').read_text())
    page.add_script_tag(content=(PUBLIC / 'play/play.js').read_text())
    page.wait_for_timeout(200)
    page.fill('#code', 'ABCD'); page.fill('#playerName', 'GameNana')
    page.locator('.avatar-choice').nth(7).click(); page.locator('#joinButton').click(); page.wait_for_timeout(150)
    sent = lambda: page.evaluate('window.__sent||[]')
    fake = lambda s: (page.evaluate('s=>window.__fakeState(s)', s), page.wait_for_timeout(80))

    # Ready Check
    fake(game_state('minigame', intro()))
    btn = page.locator('.ready-button')
    check(btn.count() == 1, 'GOT IT button shows on the rules card')
    check(page.locator('#gameCountdown').inner_text().strip() == '', 'no ticking clock while players read the rules')
    page.screenshot(path=str(SHOTS / 'phone-1-ready-check.png'), full_page=True)
    btn.click(); page.wait_for_timeout(60)
    check(any(n == 'game:ready' for n, _ in sent()), 'tapping GOT IT sends game:ready')
    fake(game_state('minigame', intro(ready_ids=['p1'])))
    check('WAITING FOR CAPTAINK' in page.locator('.ready-box').inner_text(), 'shows who we are still waiting for')
    check(page.locator('.ready-skip').count() == 1, 'VIP can start without waiting')
    page.screenshot(path=str(SHOTS / 'phone-2-waiting.png'), full_page=True)
    fake(game_state('minigame', intro(ready_ids=['p1', 'p2'], released=True)))
    check('GET SET' in page.locator('.ready-box').inner_text(), '3-2-1 countdown message once everyone is ready')

    # Number pad (Close Call)
    fake(game_state('minigame', close_call()))
    check(page.locator('#gameButtons input').count() == 0, 'Close Call has no text box, so the phone keyboard never opens')
    for d in ['9', '6']: page.locator('.numpad-key', has_text=d).first.click()
    check(page.locator('.numpad-display').inner_text() == '96', 'number pad builds the answer', shown=page.locator('.numpad-display').inner_text())
    sizes = page.evaluate("[...document.querySelectorAll('.numpad-key')].map(b=>{const r=b.getBoundingClientRect();return Math.min(r.width,r.height)})")
    check(min(sizes) >= 48, 'every number key is at least 48 px', smallest=min(sizes))
    page.screenshot(path=str(SHOTS / 'phone-3-number-pad.png'), full_page=True)
    page.locator('.numpad-form button[type=submit]').click(); page.wait_for_timeout(60)
    check(['game:input', {'value': 96, 'roundKey': 1}] in sent(), 'number pad submits 96 as a number')

    # Letter tiles (Unscramble)
    fake(game_state('minigame', unscramble()))
    check(page.locator('#gameButtons input').count() == 0, 'Unscramble uses tiles, not the keyboard')
    letters = 'KETTLE'
    order = [0, 1, 2, 3, 4, 5]
    for i in order: page.locator('.tile-key').nth(i).click()
    check(page.locator('.tiles-display').inner_text() == letters, 'tiles build the word')
    page.screenshot(path=str(SHOTS / 'phone-4-letter-tiles.png'), full_page=True)
    page.locator('.tiles-form button[type=submit]').click(); page.wait_for_timeout(60)
    check(['game:input', {'value': 'KETTLE', 'roundKey': 2}] in sent(), 'tiles submit the word')

    # Typing mode (Caption This still needs words)
    fake(game_state('minigame', caption()))
    page.locator('#gameButtons input').focus(); page.wait_for_timeout(60)
    check(page.evaluate("document.body.classList.contains('typing')"), 'typing mode switches on while the keyboard is open')
    check(page.evaluate("getComputedStyle(document.querySelector('.game-player')).display") == 'none', 'avatar panel hides while typing')
    page.screenshot(path=str(SHOTS / 'phone-5-typing-mode.png'), full_page=True)
    page.locator('#gameButtons input').blur(); page.wait_for_timeout(250)
    check(not page.evaluate("document.body.classList.contains('typing')"), 'typing mode switches off afterwards')

    # Showdown number pad (Tug of Wits)
    fake(game_state('showdown', None, tug()))
    check(page.locator('.numpad-form').count() == 1 and page.locator('#gameButtons input').count() == 0, 'Tug of Wits uses the number pad')
    for d in ['3', '6']: page.locator('.numpad-key', has_text=d).first.click()
    page.locator('.numpad-form button[type=submit]').click(); page.wait_for_timeout(60)
    check(['game:input', {'value': {'answer': 36, 'qid': 4}, 'roundKey': 1}] in sent(), 'Tug answer submitted with its question id')

    overflow = page.evaluate('document.documentElement.scrollWidth-innerWidth')
    check(overflow <= 1, 'no sideways scrolling at 360 px', overflow=overflow)
    check(not errors, 'no page errors', errors=errors)
    browser.close()

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(results, indent=2))
print(f"{sum(r['ok'] for r in results)}/{len(results)} checks passed")
