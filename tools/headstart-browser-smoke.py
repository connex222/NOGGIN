"""HEADSTART browser smoke test: steps through every tutorial slide on the real TV page
at three screen sizes and checks nothing overflows or errors.  Run: python tools/headstart-browser-smoke.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
PUBLIC=ROOT/'public'
OUT=ROOT/'docs/previews/headstart'
OUT.mkdir(parents=True,exist_ok=True)
def route(r):
    rel=r.request.url.split('://',1)[1].split('/',1)[1].split('?')[0]
    f=PUBLIC/rel
    if f.is_file(): r.fulfill(path=str(f))
    else: r.fulfill(status=404,body='')
with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox'])
  for w,h in [(1280,720),(1920,1080),(1024,768)]:
    page=b.new_page(viewport={'width':w,'height':h});errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
    page.add_init_script("try{localStorage.setItem('noggin-headstart-voice','false')}catch(e){}")
    page.route('**/*',route);page.goto('http://noggin.test/tv/index.html');page.wait_for_timeout(800)
    page.click('#welcomeHeadstart');page.wait_for_timeout(500)
    n=page.evaluate('NogginHeadstart.slides.length');bad=[]
    for i in range(n):
      page.wait_for_timeout(1700 if i in (3,4) else 900)
      info=page.evaluate("""()=>{const s=document.getElementById('htStage'),c=document.querySelector('.ht-copy'),r=document.getElementById('headstart');
        const over=el=>el.scrollHeight-el.clientHeight;const out=[...s.querySelectorAll('*')].filter(e=>{const a=e.getBoundingClientRect(),q=s.getBoundingClientRect();return a.width&&(a.bottom>q.bottom+2||a.right>q.right+2||a.left<q.left-2||a.top<q.top-2)}).length;
        return {title:document.getElementById('htTitle').textContent,stageOver:over(s),copyBottom:Math.round(c.getBoundingClientRect().bottom),footTop:Math.round(document.querySelector('.ht-foot').getBoundingClientRect().top),pageOver:[r.scrollWidth-innerWidth,r.scrollHeight-innerHeight],outside:out}}""")
      if info['stageOver']>2 or info['outside'] or info['copyBottom']>info['footTop'] or max(info['pageOver'])>1: bad.append((i,info))
      if w==1280: page.screenshot(path=str(OUT/f'slide-{i+1:02d}-1280x720.png'))
      if i<n-1: page.keyboard.press('ArrowRight')
    errs=[e for e in errs if 'io is not defined' not in e]
    assert not bad and not errs,(w,h,bad[:3],errs[:3])
    page.click('#htStartRoom');page.wait_for_timeout(400)
    assert page.evaluate("document.getElementById('headstart').hidden"),'START A ROOM should close the tutorial'
    assert 'welcome-dismissed' in page.get_attribute('#welcomeScreen','class'),'START A ROOM should open the lobby'
    print(w,h,'slides',n,'ok')
  print('HEADSTART BROWSER SMOKE: every slide fits at 1280x720, 1920x1080 and 1024x768; START A ROOM opens the lobby')
  b.close()
