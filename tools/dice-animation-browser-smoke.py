"""Mocked TV board browser smoke; all game JS runs, no live socket/server."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import time,json,re,base64
ROOT=Path(__file__).resolve().parent.parent
PUBLIC=ROOT/'public'
PREVIEW=ROOT/'docs/previews/arena-dice'
PREVIEW.mkdir(parents=True,exist_ok=True)
html=(PUBLIC/'tv/index.html').read_text()
html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',html)
css='\n'.join((PUBLIC/p).read_text() for p in ['shared/theme.css','tv/tv.css','tv/showcase.css','tv/arena-board.css'])
for asset in ['board-stage.webp','welcome-stage.webp','lobby-stage.webp']:
    path='/tv/art/'+asset
    uri='data:image/webp;base64,'+base64.b64encode((PUBLIC/path.lstrip('/')).read_bytes()).decode('ascii')
    css=css.replace(path,uri)
html=html.replace('</head>','<style>'+css+'</style></head>')
html=html.replace('src="/play/art/noggin-logo.webp"','src="data:image/webp;base64,'+base64.b64encode((PUBLIC/'play/art/noggin-logo.webp').read_bytes()).decode()+'"')
avatars=json.loads((PUBLIC/'shared/avatars.json').read_text())
for avatar in avatars:
 for state in ['think','win','lose']:
  path=avatar['think'] if state=='think' else avatar['images'][state]
  uri='data:image/webp;base64,'+base64.b64encode((PUBLIC/path.lstrip('/')).read_bytes()).decode('ascii')
  if state=='think':avatar['think']=uri
  else:avatar['images'][state]=uri
fetchmock="window.fetch=async(u)=>({ok:true,json:async()=>{if(String(u).includes('avatars'))return "+json.dumps(avatars)+";if(String(u).includes('board-data'))return "+(PUBLIC/'shared/board-data.json').read_text()+";return {files:[],music:{}};}});"
MOCK=r'''(()=>{
const listeners={};const socket={connected:true,on(k,cb){listeners[k]=cb;return this},timeout(){return this},emit(k,p,cb){
 if(k==='room:create')setTimeout(()=>cb?.(null,{ok:true,code:'ABCD',token:'1234567812345678',joinUrl:'http://example.test/play/?room=ABCD',qrDataUrl:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',state:{code:'ABCD',phase:'lobby',players:[],canStart:false,settings:{target:12,timerSpeed:'normal',rules:'classic',familyFriendly:true,reduceMotion:false},serverNow:Date.now()}}),2);
 }};
Object.defineProperty(window,'localStorage',{configurable:true,value:{m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,v)},removeItem(k){this.m.delete(k)}}});
window.io=()=>{setTimeout(()=>listeners.connect?.(),40);return socket};
window.__tvTestState=s=>listeners['room:state']?.(s);
})();'''
players=[{'id':f'p{i}','name':name,'avatarId':i,'seat':i,'sparks':sparks,'cues':0,'position':pos,'online':True,'ready':True} for i,(name,sparks,pos) in enumerate([
    ('Judge',8,5),('Sister Sue',5,12),('Pixie',4,24),('Captain',2,32),('Dr Zee',1,3),('Agent',0,18),('Sir Pecks',3,28),('Nana',2,8)],1)]
now=int(time.time()*1000)
baseboard={'step':'await_roll','turn':5,'activeId':'p1','paused':False,'event':{'text':'Player 1 rolls the dice. Watch the TV for the next challenge!'},'leaderIds':['p1'],'result':None,'winnerIds':[], 'minigame':None,'showdown':None,'challenge':None, 'routeOptions':[],'rolls':[], 'lastMove':None}
base={'code':'ABCD','phase':'board','players':players,'settings':{'target':12,'rules':'classic','familyFriendly':True,'reduceMotion':False},'serverNow':now,'board':baseboard}
records=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width,height in [(1280,720),(1920,1080),(1366,768)]:
    ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
    page=ctx.new_page();errs=[];page.on('pageerror',lambda err:errs.append(str(err)))
    page.set_content(html)
    page.add_script_tag(content=MOCK+'\n'+fetchmock)
    for script in ['tv/sound.js','shared/client.js','tv/board-view.js','tv/tv.js','tv/showcase.js']:
      page.add_script_tag(content=(PUBLIC/script).read_text())
    page.wait_for_timeout(350)
    page.evaluate('(s)=>window.__tvTestState(s)',base);page.wait_for_timeout(200)
    metrics=page.evaluate('''()=>({playing:document.body.classList.contains('playing'),avatars:document.querySelectorAll('.score-seat img').length,tiles:document.querySelectorAll('#boardSpaces .board-space').length,tokens:document.querySelectorAll('#boardTokens .stage-token').length,overflowX:document.documentElement.scrollWidth-innerWidth,overflowY:document.documentElement.scrollHeight-innerHeight,hud:document.querySelector('#arenaBottomCue')?.textContent,logo:document.querySelector('.arena-logo')?.textContent})''')
    assert metrics['playing'], ('No game stage',width,height,errs)
    assert metrics['tiles']==36,('wrong number of spaces',metrics,errs)
    assert metrics['tokens']==8,('wrong number of tokens',metrics,errs)
    assert metrics['avatars']==8,('wrong count of scoring portraits',metrics,errs)
    assert metrics['overflowX']<=1,('horizontal overflow',metrics)
    assert metrics['overflowY']<=1,('vertical overflow',metrics)
    assert not errs,(width,height,errs)
    page.screenshot(path=str(PREVIEW/f'arena-{width}x{height}.png'))
    records.append({'viewport':f'{width}x{height}',**metrics,'errors':errs})
    if width==1280:
      small=json.loads(json.dumps(base));small['players']=players[:2]
      page.evaluate('(s)=>window.__tvTestState(s)',small);page.wait_for_timeout(180)
      assert page.locator('.score-seat').count()==2,'Two-player score strip failed'
      assert page.locator('.stage-token').count()==2,'Two-player tokens failed'
      page.screenshot(path=str(PREVIEW/'arena-2players-1280x720.png'))
      records.append({'viewport':'1280x720-2players','scorecards':2,'tokens':2,'errors':errs})
      changed=json.loads(json.dumps(base))
      changed['board']={**baseboard,'step':'minigame','minigame':{'category':'speed','id':'odd-spot','title':'Odd Spot','phase':'play','round':1,'totalRounds':5,'question':'Find the different icon on the TV!','deadline':now+15000,'roundKey':1,'display':{'grid':['●']*35+['◆']}}}
      changed['serverNow']=int(time.time()*1000)
      page.evaluate('(s)=>window.__tvTestState(s)',changed);page.wait_for_timeout(160)
      assert page.locator('#challengePanel').is_visible(),'Challenge panel missing';assert not errs,errs
      page.screenshot(path=str(PREVIEW/'arena-challenge-1280x720.png'))
      records.append({'viewport':'1280x720-challenge','panelVisible':True,'errors':errs})
    if width==1280:
      moving=json.loads(json.dumps(base))
      moving['players'][0]['position']=10
      moving['board']={**baseboard,'step':'choose_category','turn':5,'lastMove':{'playerId':'p1','from':5,'to':10,'die':5,'path':[6,7,8,9,10],'revision':27},'event':{'type':'dice','text':'Player 1 rolled a 5!'}}
      page.evaluate('(s)=>window.__tvTestState(s)',moving)
      page.wait_for_timeout(440)
      tumbling=page.evaluate("""()=>({dice:document.querySelectorAll('.noggin-die').length,faces:document.querySelectorAll('.noggin-die-face').length,pips:document.querySelectorAll('.noggin-pip').length,shown:!document.querySelector('#diceOverlay').classList.contains('hidden'),text:document.querySelector('#diceInfo').textContent,tokenCount:document.querySelectorAll('.stage-token').length,animating:document.querySelectorAll('.noggin-die').length&&document.querySelector('.noggin-die').getAnimations().length})""")
      assert tumbling['dice']==1 and tumbling['faces']==6 and tumbling['shown'] and tumbling['pips']==21,tumbling
      assert 'ROLLING' in tumbling['text'],tumbling
      page.screenshot(path=str(PREVIEW/'dice-tumbling-1280x720.png'))
      page.wait_for_timeout(960)
      result=page.evaluate("""()=>({dice:document.querySelectorAll('.noggin-die').length,shown:!document.querySelector('#diceOverlay').classList.contains('hidden'),text:document.querySelector('#diceInfo').textContent,final:document.querySelector('.noggin-die-wrap')?.dataset.result,tokenCount:document.querySelectorAll('#boardTokens .stage-token').length,overflowX:document.documentElement.scrollWidth-innerWidth,overflowY:document.documentElement.scrollHeight-innerHeight})""")
      assert result['final']=='5' and '5' in result['text'] and result['shown'],result
      assert result['overflowX']<=1 and result['overflowY']<=1,result
      page.screenshot(path=str(PREVIEW/'dice-reveal-1280x720.png'))
      page.evaluate('(s)=>window.__tvTestState(s)',moving)
      page.wait_for_timeout(750)
      assert 'hidden' in (page.locator('#diceOverlay').get_attribute('class') or ''),'The die did not dismiss'
      choice=json.loads(json.dumps(moving))
      choice['board']={**baseboard,'step':'choose_die','rolls':[2,6],'lastMove':moving['board']['lastMove'],'turn':6,'activeId':'p1'}
      page.evaluate('(s)=>window.__tvTestState(s)',choice)
      page.wait_for_timeout(1400)
      assert page.locator('.noggin-die').count()==2,'Catch-up roll must show two dice'
      assert '2' in page.locator('#diceInfo').inner_text() and '6' in page.locator('#diceInfo').inner_text()
      page.screenshot(path=str(PREVIEW/'dice-choice-1280x720.png'))
      page.evaluate("()=>document.documentElement.classList.add('reduce-motion')")
      reduced=json.loads(json.dumps(moving));reduced['board']['lastMove']['revision']=28
      page.evaluate('(s)=>window.__tvTestState(s)',reduced)
      page.wait_for_timeout(80)
      assert '5' in page.locator('#diceInfo').inner_text(),'Reduced motion result not shown'
      assert not errs,errs
      records.append({'viewport':'1280x720-dice','roll':tumbling,'reveal':result,'choice':True,'reducedMotion':True,'errors':errs})
    ctx.close()
 browser.close()
(PREVIEW/'browser-results.json').write_text(json.dumps(records,indent=2))
print('DICE + ARENA UI SMOKE: 3 TV viewports, rolling, reveal, 2 dice, repeated state, reduced motion, no browser errors')
