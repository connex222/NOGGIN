"""NOGGIN v2 phone UI integration smoke test (mocked Socket.IO only; no live multiplayer)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time,re,base64
ROOT=Path(__file__).resolve().parent.parent
PUBLIC=ROOT/'public'
OUT=ROOT/'docs/previews/phone-v2'
OUT.mkdir(parents=True,exist_ok=True)
html=(PUBLIC/'play/index.html').read_text()
html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',html)
css='\n'.join((PUBLIC/p).read_text() for p in ['shared/theme.css','play/play.css','play/studio.css'])
html=html.replace('</head>','<style>'+css+'</style></head>')
logo=base64.b64encode((PUBLIC/'play/art/noggin-logo.webp').read_bytes()).decode('ascii')
html=html.replace('src="/play/art/noggin-logo.webp"','src="data:image/webp;base64,'+logo+'"')
avatars=json.loads((PUBLIC/'shared/avatars.json').read_text())
for avatar in avatars:
 for state in ['think','win','lose']:
  path=avatar['think'] if state=='think' else avatar['images'][state]
  url='data:image/webp;base64,'+base64.b64encode((PUBLIC/path.lstrip('/')).read_bytes()).decode('ascii')
  if state=='think': avatar['think']=url
  else: avatar['images'][state]=url
fetchmock='window.fetch=async()=>({ok:true,json:async()=>'+json.dumps(avatars)+'});'
MOCK=r"""(()=>{
  Object.defineProperty(window,'localStorage',{configurable:true,value:{m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,v)},removeItem(k){this.m.delete(k)}}});
  let handlers={},room={code:'ABCD',phase:'lobby',canStart:false,hostOnline:true,settings:{target:12,timerSpeed:'normal',reduceMotion:false,familyFriendly:true,rules:'showtime'},players:[],serverNow:Date.now(),board:null};
  const socket={connected:true,on(n,fn){handlers[n]=fn;return this},timeout(){return this},emit(n,p,callback){
    let r={ok:true,state:room};
    if(n==='room:resume')r={ok:false,message:'No previous seat'};
    if(n==='room:peek')r={ok:true,state:room};
    if(n==='room:join'){
      room={...room,players:[{id:'p1',name:'GameNana',avatarId:8,seat:1,sparks:8,cues:2,ready:true,online:true,position:4},{id:'p2',name:'CaptainK',avatarId:4,seat:2,sparks:5,cues:0,ready:true,online:true,position:12}]};
      r={ok:true,code:'ABCD',playerId:'p1',token:'12345678abcdefg',state:room};
    }
    if(n==='room:ready')r={ok:true,state:room};
    setTimeout(()=>callback?.(null,r),1);
  }};
  window.io=()=>{setTimeout(()=>handlers.connect?.(),20);return socket;};
  window.__fakeState=(next)=>{room=next;handlers['room:state']?.(room)};
})();"""
ids=['quick-draw','count-flash','odd-spot','colour-clash','higher-lower','memory-lane','close-call','unscramble',
     'sketch-sabotage','noise-annoys','caption-this','fib-factory','mind-meld','majority-rules','relay-sums','bomb-squad']

def mini_state(ident):
 now=int(time.time()*1000)
 base={'id':ident,'title':ident.replace('-',' ').title(),'round':2,'totalRounds':5,'roundKey':2,'phase':'play','rule':'Pick the best answer and use your head!','question':'Look closely at the TV to solve this challenge.','introUntil':now-3000,'deadline':now+32000,'participants':['p1','p2'],'eliminated':[],'answered':[],'voted':[],'progress':{'p1':1},'scores':{},'strikes':{},'blocked':{},'private':{},'display':{'word':'BLUE','ink':'GREEN','reverse':False,'sequenceLength':5,'strokes':[],'category':'Objects','options':['The first answer','The second answer','The third answer'],'partners':['p2'],'teams':[['p1'],['p2']],'totals':[4,4],'progress':[0,0],'wires':['RED','BLUE','GREEN'],'cut':[],'keypadReady':False}}
 if ident=='sketch-sabotage':base['private']={'role':'artist','word':'A GUITAR'}
 if ident=='noise-annoys':base['private']={'clue':'CRASHING WAVES'}
 if ident=='relay-sums':base['private']={'role':'relay-solver','prompt':'18 + 19 = ?'}
 if ident=='bomb-squad':base['private']={'clues':['RED goes first','BLUE is the final wire']}
 return base

def board(step='minigame',ident='odd-spot'):
 now=int(time.time()*1000)
 return {'step':step,'turn':5,'activeId':'p1','paused':False,'turnEnded':False,'event':{'type':'test','text':'TV is live'},'result':None,'winnerIds':[],
  'minigame':mini_state(ident) if step=='minigame' else None,
  'showdown':None,'deadline':now+35000,'nextAt':now+14000,'routeOptions':[{'steps':3,'cost':0,'type':'brain'},{'steps':4,'cost':1,'type':'speed'}], 'rolls':[3,5], 'history':[]}

stats=[]
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width,height in [(360,640),(390,844),(430,932)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,has_touch=True,is_mobile=True)
  page=ctx.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  page.set_content(html)
  page.add_script_tag(content=MOCK+'\n'+fetchmock)
  page.add_script_tag(content=(PUBLIC/'shared/client.js').read_text())
  page.add_script_tag(content=(PUBLIC/'play/play.js').read_text())
  page.wait_for_timeout(170)
  assert page.locator('.phone-brand img').evaluate('(i)=>i.naturalWidth')>0,'Brand logo did not load'
  if width==390:page.screenshot(path=str(OUT/'join-390.png'),full_page=True)
  page.fill('#code','ABCD');page.fill('#playerName','GameNana');page.locator('.avatar-choice').nth(7).click();page.locator('#joinButton').click();page.wait_for_timeout(180)
  assert not page.locator('#lobbyScreen').evaluate("e=>e.classList.contains('hidden')"),'Lobby did not open'
  if width==390:page.screenshot(path=str(OUT/'lobby-390.png'),full_page=True)
  for ident in ids:
   b=board('minigame',ident)
   state={'code':'ABCD','phase':'board','settings':{'target':12,'rules':'showtime'},'players':[{'id':'p1','name':'GameNana','avatarId':8,'seat':1,'sparks':8,'cues':2,'ready':True,'online':True},{'id':'p2','name':'CaptainK','avatarId':4,'seat':2,'sparks':5,'cues':0,'ready':True,'online':True}], 'serverNow':int(time.time()*1000),'board':b}
   page.evaluate('s=>window.__fakeState(s)',state);page.wait_for_timeout(45)
   props=page.evaluate('''()=>({overflow:document.documentElement.scrollWidth-innerWidth,buttons:document.querySelectorAll('#gameButtons button').length,forms:document.querySelectorAll('#gameButtons form').length,
      logo:document.querySelector('.phone-brand img').naturalWidth,tag:document.querySelector('#gameStateTag').textContent.trim(),inputs:document.querySelectorAll('#gameButtons input').length,
      canvas:document.querySelectorAll('#gameButtons canvas').length})''')
   assert props['overflow']<=1,(width,height,ident,'horizontal overflow',props)
   assert props['buttons']>0 or props['forms']>0 or props['canvas']>0 or ident in ('noise-annoys',),(width,height,ident,'no controls',props)
   assert not errs,(width,height,ident,errs)
   stats.append({'width':width,'height':height,'id':ident,**props})
   if width==390 and ident in ('odd-spot','colour-clash','memory-lane','sketch-sabotage','caption-this','relay-sums','bomb-squad'):
    page.screenshot(path=str(OUT/(ident+'-390.png')),full_page=True)
   if width==360 and ident=='odd-spot':page.screenshot(path=str(OUT/'odd-spot-360.png'),full_page=True)
  for kind,phase in [('buzzer','buzz'),('buzzer','answer'),('tug','play'),('bid','auction'),('bid','name'),('nerve','play'),('tiebreak','guess')]:
   duel={'kind':kind,'title':{'buzzer':'Buzzer Battle','tug':'Tug of Wits','bid':'Bid to Win','nerve':'Nerve','tiebreak':'NOGGIN-OFF'}[kind],
     'phase':phase,'participants':['p1','p2'],'question':'Choose your answer or take your turn!', 'deadline':int(time.time()*1000)+32000,'roundKey':3,'round':2,
     'display':{'points':{'p1':2,'p2':1},'answerId':'p1' if phase=='answer' else None,'choices':['Earth','Mars','Saturn','Venus'],
       'rope':3,'bid':2,'max':5,'turnId':'p1','bidderId':'p1','correct':1,'invalid':0,'number':9,'banks':[], 'answered':[], 'unit':'meters'},
     'private':{'prompt':'17 + 18 = ?', 'qid':'q1'}, 'cheerOpen':True,'myCheer':None}
   b=board('showdown');b['showdown']=duel
   testState={**state,'board':b}
   page.evaluate('s=>window.__fakeState(s)',testState);page.wait_for_timeout(45)
   metrics=page.evaluate('''()=>({overflow:document.documentElement.scrollWidth-innerWidth,buttons:document.querySelectorAll('#gameButtons button').length,forms:document.querySelectorAll('#gameButtons form').length})''')
   assert metrics['overflow']<=1,(width,kind,phase,'overflow')
   assert metrics['buttons']>0 or metrics['forms']>0,(width,kind,phase,'missing input')
   assert not errs,(width,kind,phase,errs)
   stats.append({'width':width,'height':height,'id':'showdown-'+kind+'-'+phase,**metrics})
   if width==390 and (kind,phase) in [('buzzer','buzz'),('tug','play'),('bid','auction')]:
    page.screenshot(path=str(OUT/('showdown-'+kind+'-390.png')),full_page=True)
  for step in ['await_roll','choose_route','choose_die','choose_category','result','finished']:
   s={**state,'board':board(step)}
   if step=='finished':s['board']['winnerIds']=['p1']
   if step=='result':s['board']['result']={'text':'You won 2 Sparks!','winners':['p1']}
   page.evaluate('s=>window.__fakeState(s)',s);page.wait_for_timeout(35)
   assert page.evaluate('document.documentElement.scrollWidth-innerWidth')<=1,(width,step,'overflow')
   if width==390 and step in ('await_roll','result'):page.screenshot(path=str(OUT/(step+'-390.png')),full_page=True)
  assert not errs,(width,errs)
  ctx.close()
 browser.close()
(OUT/'browser-results.json').write_text(json.dumps({'checked':len(stats),'screens':stats},indent=2))
print(f'NOGGIN PHONE V2 BROWSER SMOKE: {len(stats)} live DOM scenes across 3 phone viewports, zero page errors or horizontal overflow')
