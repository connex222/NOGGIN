"""NOGGIN v3.5.0 Batch 3 phone input smoke test (real Chromium, mocked Socket.IO).

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
OUT = ROOT / 'docs/test-history/v350-phone-input-browser-results.json'

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

results = []
def check(cond, label, **extra):
    results.append({'check': label, 'ok': bool(cond), **extra})
    assert cond, (label, extra)

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path=('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None), args=['--no-sandbox', '--disable-dev-shm-usage'])

    def open_page(stored='{}', width=360, height=640):
        ctx = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1, has_touch=True, is_mobile=True)
        page = ctx.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.set_content(html)
        page.add_script_tag(content=mock(stored) + '\n' + fetchmock)
        page.add_script_tag(content=(PUBLIC / 'shared/client.js').read_text())
        page.add_script_tag(content=(PUBLIC / 'play/play.js').read_text())
        page.wait_for_timeout(200)
        return ctx, page, errors

    ctx, page, errors = open_page()
    page.fill('#code', 'ABCD'); page.fill('#playerName', 'GameNana')
    page.locator('.avatar-choice').nth(7).click(); page.locator('#joinButton').click(); page.wait_for_timeout(150)
    check(not page.evaluate("document.getElementById('lobbyScreen').classList.contains('hidden')"), 'joined lobby')

    # D16: profile saved on join
    profile = page.evaluate("JSON.parse(localStorage.getItem('noggin-player-profile-v1'))")
    check(profile == {'name': 'GameNana', 'avatarId': 8}, 'D16 profile saved on join', profile=profile)

    # D6: lobby avatar picker kept when only ready state changes
    page.evaluate("document.querySelector('#swapAvatarGrid button').__mark=1")
    lobby = {'code': 'ABCD', 'phase': 'lobby', 'vipId': 'p1', 'hostOnline': True, 'canStart': False, 'serverNow': now(), 'board': None,
             'settings': {'rounds': 'auto', 'rules': 'classic', 'timerSpeed': 'normal', 'roundStyle': 'everyone', 'familyFriendly': True, 'reduceMotion': False},
             'players': [{**PLAYERS[0], 'ready': False}, {**PLAYERS[1], 'ready': True}]}
    page.evaluate('s=>window.__fakeState(s)', lobby); page.wait_for_timeout(40)
    check(page.evaluate("document.querySelector('#swapAvatarGrid button').__mark===1"), 'D6 avatar picker not rebuilt by a ready change')

    # D12: VIP dropdown kept across unrelated broadcasts, rebuilt when settings change
    page.evaluate("document.querySelector('#vipControls select').__mark=1")
    page.evaluate('s=>window.__fakeState(s)', {**lobby, 'serverNow': now()}); page.wait_for_timeout(40)
    check(page.evaluate("document.querySelector('#vipControls select').__mark===1"), 'D12 VIP dropdown not rebuilt by an unrelated broadcast')
    page.evaluate('s=>window.__fakeState(s)', {**lobby, 'settings': {**lobby['settings'], 'timerSpeed': 'relaxed'}}); page.wait_for_timeout(40)
    check(page.evaluate("document.querySelector('#vipControls select').__mark!==1"), 'D12 VIP controls refresh when a setting changes')

    # D15: tap targets on a 360 px phone, Odd Spot level 5
    page.evaluate('s=>window.__fakeState(s)', game_state('minigame', odd_spot())); page.wait_for_timeout(60)
    sizes = page.evaluate("[...document.querySelectorAll('#gameButtons .mini-grid-button')].map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width*10)/10,Math.round(r.height*10)/10]})")
    check(len(sizes) == 36, 'Odd Spot grid has 36 squares')
    smallest = [min(w for w, h in sizes), min(h for w, h in sizes)]
    check(smallest[0] >= 48 and smallest[1] >= 48, 'D15 every Odd Spot square is at least 48 x 48 px at 360 px', smallest=smallest)
    overflow = page.evaluate('document.documentElement.scrollWidth-innerWidth')
    check(overflow <= 1, 'D15 no sideways scrolling at 360 px', overflow=overflow)
    scaled = page.evaluate("[...document.querySelectorAll('#gameButtons .mini-grid-button span')].filter(s=>s.style.transform.includes('scale')).length")
    check(scaled == 1, 'D15 level 5 shows exactly one smaller symbol')

    # D6: another player answering does not rebuild my grid
    page.evaluate("document.querySelector('#gameButtons .mini-grid').__mark=1")
    page.evaluate('s=>window.__fakeState(s)', game_state('minigame', odd_spot(answered=['p2']))); page.wait_for_timeout(40)
    check(page.evaluate("document.querySelector('#gameButtons .mini-grid').__mark===1"), 'D6 Odd Spot grid kept when someone else answers')
    # ...but my own lock-out does change the controls
    page.evaluate('s=>window.__fakeState(s)', game_state('minigame', odd_spot(blocked={'p1': now() + 3000})))
    page.wait_for_timeout(40)
    locked = page.evaluate("[...document.querySelectorAll('#gameButtons .mini-grid-button')].every(b=>b.disabled)")
    check(locked, 'D6 own wrong-tap lock-out disables my grid')

    # D6: Nerve BANK button survives counter ticks; the counter text updates
    page.evaluate('s=>window.__fakeState(s)', game_state('showdown', None, nerve(9))); page.wait_for_timeout(40)
    page.evaluate("[...document.querySelectorAll('#gameButtons button')].find(b=>b.textContent.includes('BANK')).__mark=1")
    for n in (10, 11, 12):
        page.evaluate('s=>window.__fakeState(s)', game_state('showdown', None, nerve(n))); page.wait_for_timeout(25)
    kept = page.evaluate("[...document.querySelectorAll('#gameButtons button')].find(b=>b.textContent.includes('BANK')).__mark===1")
    counter = page.evaluate("document.getElementById('gameButtons').textContent")
    check(kept, 'D6 Nerve BANK button is never rebuilt while the counter ticks')
    check('CURRENT COUNTER: 12' in counter, 'D6 Nerve counter text still updates', text=counter[:80])

    # D6: a pad tapped once is usable again straight after (no stuck disabled button)
    page.evaluate('s=>window.__fakeState(s)', game_state('minigame', memory())); page.wait_for_timeout(40)
    page.locator('#gameButtons .memory-pad').nth(2).click(); page.wait_for_timeout(60)
    page.evaluate('s=>window.__fakeState(s)', game_state('minigame', memory())); page.wait_for_timeout(40)
    check(not page.evaluate("document.querySelectorAll('#gameButtons .memory-pad')[2].disabled"), 'D6 a tapped pad is ready for the next tap')

    # D7: Quick Draw switches to DRAW on the phone itself and sends a reaction time
    qd = {'id': 'quick-draw', 'category': 'speed', 'title': 'Quick Draw', 'rule': 'Wait', 'round': 1, 'totalRounds': 3, 'roundKey': 9,
          'phase': 'wait', 'question': 'Wait for DRAW', 'introUntil': now() - 9000, 'deadline': now() + 9000, 'openAt': now() + 700,
          'participants': ['p1', 'p2'], 'eliminated': [], 'answered': [], 'progress': {}, 'scores': {}, 'strikes': {}, 'blocked': {}, 'display': {}}
    page.evaluate('s=>window.__fakeState(s)', game_state('minigame', qd)); page.wait_for_timeout(60)
    check('WAIT' in page.inner_text('#gameButtons .quick-draw-button'), 'D7 Quick Draw shows WAIT before DRAW time')
    page.evaluate("document.querySelector('#gameButtons .quick-draw-button').__mark=1")
    page.wait_for_timeout(900)  # no new broadcast: the phone must switch by itself
    check('DRAW' in page.inner_text('#gameButtons .quick-draw-button'), 'D7 Quick Draw switches to DRAW without waiting for the server')
    page.evaluate('s=>window.__fakeState(s)', game_state('minigame', {**qd, 'phase': 'play'})); page.wait_for_timeout(40)
    check(page.evaluate("document.querySelector('#gameButtons .quick-draw-button').__mark===1"), 'D7 the server\'s own DRAW does not rebuild the button')
    page.wait_for_timeout(150); page.locator('#gameButtons .quick-draw-button').click(); page.wait_for_timeout(40)
    sent = page.evaluate("window.__sent.filter(([n])=>n==='game:input').pop()[1]")
    check(isinstance(sent['value'], dict) and 100 <= sent['value'].get('reactionMs', 0) <= 1500, 'D7 Quick Draw sends the phone-measured reaction time', sent=sent)

    # D8: Shape Clash draws a shape and offers shape buttons
    sc = {**memory(), 'id': 'colour-clash', 'title': 'Shape Clash', 'roundKey': 11, 'display': {'mode': 'shape', 'shape': 'SQUARE', 'word': 'CIRCLE', 'difficulty': 1}}
    page.evaluate('s=>window.__fakeState(s)', game_state('minigame', sc)); page.wait_for_timeout(60)
    check(page.locator('#gameButtons svg.shape-clash rect').count() == 1, 'D8 Shape Clash draws the outline shape')
    labels = page.evaluate("[...document.querySelectorAll('#gameButtons button')].map(b=>b.textContent)")
    check(labels == ['● CIRCLE', '■ SQUARE', '▲ TRIANGLE', '★ STAR'], 'D8 Shape Clash buttons name shapes, not colours', labels=labels)

    # D15: every visible game button at least 48 px tall
    heights = page.evaluate("[...document.querySelectorAll('#gameButtons button')].map(b=>b.getBoundingClientRect().height)")
    check(min(heights) >= 48, 'D15 all game buttons at least 48 px tall', smallest=min(heights))
    check(not errors, 'no page errors', errors=errors)
    ctx.close()

    # D16: a fresh visit prefills the remembered name and character
    stored = json.dumps({'noggin-player-profile-v1': json.dumps({'name': 'GameNana', 'avatarId': 8})})
    ctx, page, errors = open_page(stored)
    page.wait_for_timeout(100)
    check(page.input_value('#playerName') == 'GameNana', 'D16 name prefilled')
    check(page.evaluate("document.querySelectorAll('#avatarGrid .avatar-choice')[7].classList.contains('selected')"), 'D16 character preselected')
    check(not errors, 'no page errors on prefill', errors=errors)
    ctx.close()
    browser.close()

OUT.write_text(json.dumps({'checked': len(results), 'results': results}, indent=2) + '\n')
print(f'NOGGIN v3.5.0 PHONE INPUT SMOKE: {len(results)} checks passed in Chromium')
