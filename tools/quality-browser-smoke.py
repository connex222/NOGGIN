"""Quality upgrade mocked Socket.IO UI smoke test. This is NOT a live multiplayer/network test."""
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import base64,io,json,re,time,os
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
PUBLIC=ROOT/'public'
AVATARS=json.loads((PUBLIC/'shared/avatars.json').read_text())
for a in AVATARS:
 for label in ['think','win','lose']:
  path=a['think'] if label=='think' else a['images'][label]
  im=Image.open(PUBLIC/path.lstrip('/'));im.thumbnail((130,130));buf=io.BytesIO();im.save(buf,format='PNG')
  val='data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode('ascii')
  if label=='think':a['think']=val
  else:a['images'][label]=val
BOARD=json.loads((PUBLIC/'shared/board-data.json').read_text())
MOCK="""(()=>{let current={code:'ABCD',phase:'lobby',hostOnline:true,canStart:false,settings:{target:12,timerSpeed:'normal',reduceMotion:false,familyFriendly:true},players:[],serverNow:Date.now(),board:null};window.io=()=>{let handlers={};const s={connected:true,on:(k,fn)=>(handlers[k]=fn,s),timeout:()=>s,emit:(name,payload,cb)=>{let out={ok:true};if(name==='room:resume')out={ok:false,message:'No session'};if(name==='room:create')out={ok:true,code:'ABCD',token:'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',state:current,joinUrl:'http://192.168.1.100:3000/play/?room=ABCD',qrDataUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E'};if(name==='room:peek')out={ok:true,state:current};if(name==='room:join')out={ok:true,code:'ABCD',playerId:'p1',token:'ABCDEFGHIJKLMNOPQRSTUVWX12345678',state:{...current,players:[{id:'p1',name:'Player 1',avatarId:1,seat:1,sparks:0,position:0,ready:true,online:true}]}};setTimeout(()=>cb?.(null,out),5);}};window.__emitFake=(data)=>{current=data;handlers['room:state']?.(data);};setTimeout(()=>handlers.connect?.(),25);return s;};})();"""
fetchJS='window.fetch=async(url)=>({ok:true,json:async()=>String(url).includes("avatars")?'+json.dumps(AVATARS)+':String(url).includes("board-data")?'+json.dumps(BOARD)+':({files:[]})});'
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for name,w,h,view in [('tv720',1280,720,'tv'),('tv1080',1920,1080,'tv'),('phone640',360,640,'play'),('phone932',430,932,'play')]:
  ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  html=(PUBLIC/view/'index.html').read_text();html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html);html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',html)
  css=(PUBLIC/'shared/theme.css').read_text()+(PUBLIC/view/f'{view}.css').read_text();html=html.replace('</head>','<style>'+css+'</style></head>')
  page.set_content(html);page.add_script_tag(content="Object.defineProperty(window,'localStorage',{configurable:true,value:{m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,v)},removeItem(k){this.m.delete(k)}}});"+MOCK+'\n'+fetchJS)
  page.add_script_tag(content=(PUBLIC/'shared/client.js').read_text())
  if view=='tv':page.add_script_tag(content=(PUBLIC/'tv/board-view.js').read_text());page.add_script_tag(content=(PUBLIC/'tv/sound.js').read_text())
  page.add_script_tag(content=(PUBLIC/view/f'{view}.js').read_text());page.wait_for_timeout(260)
  if view=='play':
   page.fill('#code','ABCD');page.fill('#playerName','Player 1');page.locator('.avatar-choice').first.click();page.locator('#joinButton').click();page.wait_for_timeout(150)
  players=[{'id':f'p{i}','name':f'Player {i}','avatarId':i,'seat':i,'ready':True,'online':True,'sparks':3,'position':[7,10][i-1]} for i in range(1,3)]
  now=int(time.time()*1000)
  base={'code':'ABCD','phase':'board','hostOnline':True,'canStart':False,'settings':{'target':12,'timerSpeed':'normal','familyFriendly':True,'reduceMotion':False},'players':players,'serverNow':now}
  snapshots=[]
  for kind,phase in [('buzzer','buzz'),('buzzer','answer'),('tug','play'),('bid','auction'),('bid','name'),('nerve','rising'),('tiebreak','guess')]:
   duel={'kind':kind,'title':{'buzzer':'Buzzer Battle','tug':'Tug of Wits','bid':'Bid to Win','nerve':'Nerve','tiebreak':'NOGGIN-OFF · CLOSE CALL'}[kind],
     'phase':phase,'participants':['p1','p2'],'openAt':now-2000,'deadline':now+38000,'hardStop':now+48000,'roundKey':2,'answered':[],
     'question':'Which planet has rings?' if kind=='buzzer' else 'Name the first four months of the year' if kind=='bid' else 'How many minutes are in two hours?' if kind=='tiebreak' else 'Play the showdown with your phone!',
     'display':{'points':{'p1':2,'p2':1},'choices':['Mars','Saturn','Neptune','Venus'],'answerId':'p1' if phase=='answer' else None,'correctCount':{'p1':2,'p2':0},'rope':3,'bid':2,'max':4,'bidderId':'p1','turnId':'p1','correct':1,'invalid':0,'number':4,'banks':[],'answered':[],'unit':'minutes'},
     'private':{'prompt':'18 + 17 = ?','qid':4} if kind=='tug' and view=='play' else None,'round':3}
   state={**base,'board':{'step':'showdown','turn':5,'activeId':'p1','leaderIds':['p1'],'rolls':[],'landing':7,'lastMove':None,'event':{'type':'showdown','text':duel['title']},'deadline':now+38000,'nextAt':None,'paused':False,'challenge':None,'minigame':None,'showdown':duel,'result':None,'winnerIds':[],'finalists':[],'history':[]}}
   page.evaluate('(data)=>window.__emitFake(data)',state);page.wait_for_timeout(80)
   metrics=page.evaluate('''()=>({overflow:document.documentElement.scrollWidth-innerWidth,buttons:document.querySelectorAll('#gameButtons button').length,
      show:!document.querySelector('#challengePanel')?.classList.contains('hidden'),stage:!document.querySelector('#gameStage')?.classList.contains('hidden')})''')
   if errors:raise AssertionError((view,name,kind,errors))
   assert metrics['overflow']<3,(name,kind,metrics)
   if view=='tv':assert metrics['show'] and metrics['stage'],(name,kind,metrics)
   if view=='play':assert metrics['buttons']>0 if (kind,phase) in [('buzzer','buzz'),('buzzer','answer'),('tug','play'),('bid','auction'),('bid','name'),('nerve','rising'),('tiebreak','guess')] else True,(name,kind,metrics)
   snapshots.append({'kind':kind,'phase':phase,'metrics':metrics})
   if (kind=='nerve' and phase=='rising') or (kind=='tug' and phase=='play'):
    page.screenshot(path=str(Path('/mnt/data')/f'noggin-phase5-{name}-{kind}.png'),full_page=True)

  # New feature smoke 1: the actual spectator flow and the crowd meter.
  audiencePlayers=[
   {'id':'p1','name':'Player 1','avatarId':1,'seat':1,'ready':True,'online':True,'sparks':3,'position':0},
   {'id':'p2','name':'Player 2','avatarId':2,'seat':2,'ready':True,'online':True,'sparks':5,'position':7},
   {'id':'p3','name':'Player 3','avatarId':3,'seat':3,'ready':True,'online':True,'sparks':1,'position':9},
  ]
  show={'kind':'tug','title':'Tug of Wits','phase':'play','participants':['p2','p3'],
        'openAt':now-2000,'deadline':now+20000,'hardStop':now+25000,'roundKey':1,
        'question':'Answer maths to pull the rope!', 'display':{'rope':2,'correctCount':{'p2':3,'p3':1}},
        'cheerCounts':{'p2':2,'p3':1}}
  ab={'step':'showdown','turn':4,'activeId':'p2','leaderIds':['p2'],'rolls':[],'landing':15,
      'lastMove':None,'event':{'type':'showdown','text':'Tug of Wits'},'deadline':now+20000,
      'nextAt':None,'paused':False,'challenge':None,'minigame':None,'showdown':show,
      'result':None,'winnerIds':[],'finalists':[],'history':[]}
  page.evaluate('(data)=>window.__emitFake(data)',{**base,'players':audiencePlayers,'board':ab});page.wait_for_timeout(120)
  audience=page.evaluate('''()=>({overflow:document.documentElement.scrollWidth-innerWidth,
     buttons:Array.from(document.querySelectorAll('#gameButtons button')).map(b=>b.textContent),
     meter:document.querySelector('.audience-meter')?.textContent||''})''')
  assert audience['overflow']<3,(name,'audience',audience)
  if view=='play':assert len(audience['buttons'])>=2 and all('CHEER' in x for x in audience['buttons']),(name,'audience',audience)
  else:assert 'CHEER' in audience['meter'],(name,'audience',audience)
  page.screenshot(path=str(Path('/mnt/data')/f'noggin-quality-{name}-audience.png'),full_page=True)
  snapshots.append({'kind':'audience','phase':'cheer','metrics':audience})
  # New feature smoke 2: published answer ONLY during reveal, no action buttons.
  mini={'id':'close-call','category':'brain','title':'Close Call','round':2,'totalRounds':3,'roundKey':2,
     'phase':'reveal','introUntil':None,'question':'How many?', 'hint':'','display':{'unit':'feet'},
     'deadline':now+2000,'openAt':now-8000,'participants':['p1','p2','p3'],
     'eliminated':[],'answered':['p1','p2','p3'],'progress':{},'scores':{'p1':12,'p2':5,'p3':3},'blocked':{},
     'lastRoundResult':{'round':2,'winners':['p1'],'answer':42,'scoreboard':{'p1':12,'p2':5,'p3':3}}}
  rb={**ab,'step':'minigame','activeId':'p1','showdown':None,'minigame':mini,'event':{'type':'minigame','text':'Answer reveal'}}
  page.evaluate('(data)=>window.__emitFake(data)',{**base,'players':audiencePlayers,'board':rb});page.wait_for_timeout(120)
  reveal=page.evaluate('''()=>({overflow:document.documentElement.scrollWidth-innerWidth,
    tv:document.querySelector('#challengePanel')?.textContent||'',
    phone:document.querySelector('#gameDescription')?.textContent||'',
    buttons:document.querySelectorAll('#gameButtons button').length})''')
  assert reveal['overflow']<3,(name,'reveal',reveal)
  if view=='play':assert 'CORRECT ANSWER: 42' in reveal['phone'] and reveal['buttons']==0,(name,'reveal',reveal)
  else:assert 'ANSWER: 42' in reveal['tv'],(name,'reveal',reveal)
  assert not errors,(name,errors)
  page.screenshot(path=str(Path('/mnt/data')/f'noggin-quality-{name}-reveal.png'),full_page=True)
  snapshots.append({'kind':'reveal','phase':'reveal','metrics':reveal})

  results.append({'screen':name,'rendered':len(snapshots),'errors':errors,'screens':snapshots});ctx.close()
 browser.close()
(ROOT/'quality-browser-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps([{'screen':x['screen'],'rendered':x['rendered'],'errors':x['errors']} for x in results],indent=2))
