"""Mocked browser-state layout checks. This DOES NOT test live sockets or multiplayer."""
from pathlib import Path
import base64,io,json,re,time
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent;PUBLIC=ROOT/'public'
AVATARS=json.loads((PUBLIC/'shared/avatars.json').read_text())
for a in AVATARS:
 for label in ['think','win','lose']:
  path=a['think'] if label=='think' else a['images'][label]
  im=Image.open(PUBLIC/path.lstrip('/'));im.thumbnail((100,100));buf=io.BytesIO();im.save(buf,format='PNG')
  val='data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()
  if label=='think':a['think']=val
  else:a['images'][label]=val
BOARD=json.loads((PUBLIC/'shared/board-data.json').read_text())
MOCK="""(()=>{let current={code:'ABCD',phase:'lobby',hostOnline:true,canStart:false,settings:{target:12,timerSpeed:'normal',reduceMotion:false,familyFriendly:true},players:[],serverNow:Date.now(),board:null};window.io=()=>{let handlers={};const s={connected:true,on:(k,fn)=>(handlers[k]=fn,s),timeout:()=>s,emit:(name,payload,cb)=>{let out={ok:true};if(name==='room:resume')out={ok:false,message:'No session'};if(name==='room:create')out={ok:true,code:'ABCD',token:'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',state:current,joinUrl:'http://192.168.1.100:3000/play/?room=ABCD',qrDataUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E'};if(name==='room:peek')out={ok:true,state:current};if(name==='room:join')out={ok:true,code:'ABCD',playerId:'p1',token:'ABCDEFGHIJKLMNOPQRSTUVWX12345678',state:{...current,players:[{id:'p1',name:'Player 1',avatarId:1,seat:1,sparks:0,cues:2,position:0,ready:true,online:true}]}};setTimeout(()=>cb?.(null,out),5);}};window.__emitFake=(data)=>{current=data;handlers['room:state']?.(data);};setTimeout(()=>handlers.connect?.(),25);return s;};})();"""
fetchJS='window.fetch=async(url)=>({ok:true,json:async()=>String(url).includes("avatars")?'+json.dumps(AVATARS)+':String(url).includes("board-data")?'+json.dumps(BOARD)+':({files:[]})});'
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for name,w,h,view in [('tv720',1280,720,'tv'),('tv1080',1920,1080,'tv'),('phone640',360,640,'play'),('phone932',430,932,'play')]:
  ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1);page=ctx.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  html=(PUBLIC/view/'index.html').read_text();html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html);html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',html)
  css=(PUBLIC/'shared/theme.css').read_text()+(PUBLIC/view/f'{view}.css').read_text();html=html.replace('</head>','<style>'+css+'</style></head>')
  page.set_content(html);page.add_script_tag(content="Object.defineProperty(window,'localStorage',{configurable:true,value:{m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,v)},removeItem(k){this.m.delete(k)}}});"+MOCK+'\n'+fetchJS)
  page.add_script_tag(content=(PUBLIC/'shared/client.js').read_text())
  if view=='tv':page.add_script_tag(content=(PUBLIC/'tv/board-view.js').read_text());page.add_script_tag(content=(PUBLIC/'tv/sound.js').read_text())
  page.add_script_tag(content=(PUBLIC/view/f'{view}.js').read_text());page.wait_for_timeout(260)
  if view=='play':
   page.fill('#code','ABCD');page.fill('#playerName','Player 1');page.locator('.avatar-choice').first.click();page.locator('#joinButton').click();page.wait_for_timeout(150)
  now=int(time.time()*1000)
  players=[{'id':f'p{i}','name':f'Player {i}','avatarId':i,'seat':i,'ready':True,'online':True,'sparks':i*3,'cues':2,'position':0} for i in range(1,4)]
  base={'code':'ABCD','phase':'board','hostOnline':True,'canStart':False,'settings':{'target':12,'timerSpeed':'normal','familyFriendly':True,'reduceMotion':False},'players':players,'serverNow':now}
  bd={'step':'await_roll','turn':5,'activeId':'p1','leaderIds':['p3'],'rolls':[],'landing':0,'lastMove':None,'event':{'type':'turn','text':'Your move!'},'deadline':None,'nextAt':None,'paused':False,'challenge':None,'minigame':None,'showdown':None,'result':None,'winnerIds':[],'finalists':[],'history':[],'routePlan':False,'routeOptions':[]}
  scenarios=[]
  def emit(state,scenario):
   page.evaluate('(data)=>window.__emitFake(data)',state);page.wait_for_timeout(80)
   m=page.evaluate('''()=>({overflow:document.documentElement.scrollWidth-innerWidth,buttons:Array.from(document.querySelectorAll('#gameButtons button')).map(x=>x.textContent),h:document.getElementById('gameHeadline')?.textContent,tv:document.getElementById('boardMessage')?.textContent,routeRings:document.querySelectorAll('.route-hint').length,flashItems:document.querySelectorAll('.flash-fakeout span').length})''')
   assert m['overflow']<3,(name,scenario,m)
   assert not errors,(name,scenario,errors)
   scenarios.append({'scenario':scenario,'data':m})
   return m
  m=emit({**base,'board':bd},'normal-roll')
  if view=='play':assert any('PLAN A LANDING' in x for x in m['buttons']),(name,m)
  options=[{'dieIndex':0,'offset':0,'steps':4,'landing':4,'type':'create','cost':0},{'dieIndex':0,'offset':-1,'steps':3,'landing':3,'type':'swap','cost':1},{'dieIndex':0,'offset':1,'steps':5,'landing':5,'type':'together','cost':1}]
  state={**base,'board':{**bd,'step':'choose_route','routePlan':True,'routeOptions':options,'deadline':now+8500,'rolls':[4],'event':{'type':'directors-cut','text':'Choose a landing'}}}
  m=emit(state,'directors-cut')
  if view=='play':assert len(m['buttons'])==3 and 'FREE' in m['buttons'][0],(name,m)
  else:assert m['routeRings']==3 and 'DIRECTOR' in m['tv'],(name,m)
  page.screenshot(path=str(Path('/mnt/data')/f'noggin-directors-{name}.png'),full_page=True)
  cue={'count':11,'icon':'🦆','distractor':'⚽','total':36,'seed':1837}
  mini={'id':'count-flash','category':'speed','title':'Count Flash','round':1,'totalRounds':3,'roundKey':1,'phase':'flash','introUntil':None,'question':'Count the 🦆 — ignore the impostors!','hint':'','display':{'targetIcon':'🦆','flashEndsAt':now+1000},'deadline':now+9500,'openAt':now+1000,'participants':['p1','p2','p3'],'eliminated':[],'answered':[],'progress':{},'scores':{'p1':0,'p2':0,'p3':0},'strikes':{'p1':0,'p2':0,'p3':0},'blocked':{},'tvCue':cue if view=='tv' else None}
  m=emit({**base,'board':{**bd,'step':'minigame','minigame':mini,'deadline':now+9500}},'count-flash')
  if view=='tv':assert m['flashItems']==36,(name,m)
  page.screenshot(path=str(Path('/mnt/data')/f'noggin-target-count-{name}.png'),full_page=True)
  results.append({'screen':name,'scenarios':scenarios,'errors':errors})
  ctx.close()
 browser.close()
(ROOT/'directors-cut-browser-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps([{'screen':x['screen'],'tested':[y['scenario'] for y in x['scenarios']],'errors':x['errors']} for x in results],indent=2))
