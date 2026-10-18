"""Visual browser smoke test for local Phase 3 UI using mocked socket messages.
This tests rendering only; it does NOT verify a real Socket.IO connection.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import base64,io,re
from PIL import Image
from pathlib import Path
from playwright.sync_api import sync_playwright
import threading, json, os, time
root=Path(__file__).resolve().parent.parent/'public'
os.chdir(root)
mock=r'''(() => {
const demo={code:'ABCD',phase:'lobby',hostOnline:true,canStart:false,minPlayers:2,maxPlayers:8,settings:{target:12,timerSpeed:'normal',reduceMotion:false,familyFriendly:true},players:[],serverNow:Date.now(),board:null};
let current=demo;
window.io=()=>{
 const handlers={};
 const socket={connected:true,on:(name,fn)=>{handlers[name]=fn;return socket;},timeout:()=>socket,disconnect(){socket.connected=false;},emit:(event,payload,cb)=>{
   let out={ok:true};
   if(event==='room:resume')out={ok:false,message:'No previous session'};
   if(event==='room:create')out={ok:true,code:'ABCD',token:'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',state:current,joinUrl:'http://192.168.1.99:3000/play/?room=ABCD',qrDataUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="150" height="150" fill="white"/%3E%3Cpath d="M10 10h30v30H10zm50 0h30v30H60zm50 0h30v30h-30zM10 60h30v30H10zm50 0h30v30H60zm50 0h30v30h-30zM10 110h30v30H10zm50 0h30v30H60zm50 0h30v30h-30z" fill="black"/%3E%3C/svg%3E'};
   if(event==='room:peek')out={ok:true,state:current};
   if(event==='room:join')out={ok:true,code:'ABCD',playerId:'p1',token:'ABCDEFGHIJKLMNOPQRSTUVWX12345678',state:{...current,players:[{id:'p1',name:payload.name,avatarId:payload.avatarId,seat:1,ready:false,online:true,position:0,sparks:0}]}};
   if(event==='room:ready')out={ok:true,state:current};
   setTimeout(()=>cb?.(null,out),5);
 }};
 window.__emitFake=(name,payload)=>{if(name==='room:state')current=payload;handlers[name]?.(payload);};
 setTimeout(()=>handlers.connect?.(),25);
 return socket;
};
})();'''
with open(root/'shared/avatars.json') as h: avatar_data=json.load(h)
for a in avatar_data:
 for key in ['think','win','lose']:
  filename=a['think'] if key=='think' else a['images'][key]
  img=Image.open(root/filename.lstrip('/'));img.thumbnail((140,140));stream=io.BytesIO();img.save(stream,format='PNG',optimize=True)
  data='data:image/png;base64,'+base64.b64encode(stream.getvalue()).decode('ascii')
  if key=='think':a['think']=data
  else:a['images'][key]=data
with open(root/'shared/board-data.json') as h: board_data=json.load(h)
fetch_mock='window.fetch=async(url)=>({ok:true,json:async()=>'+json.dumps(avatar_data)+" if (false)})"  # replaced just below
fetch_mock='window.fetch=async(url)=>({ok:true,json:async()=>(String(url).includes("avatars")?'+json.dumps(avatar_data)+':'+json.dumps(board_data)+')});'
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for name,w,h,kind in [('tv720',1280,720,'tv'),('tv1080',1920,1080,'tv'),('phone640',360,640,'play'),('phone932',430,932,'play')]:
  ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  html=(root/f'{kind}/index.html').read_text();html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html);html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',html)
  css=(root/'shared/theme.css').read_text()+(root/f'{kind}/{kind}.css').read_text()
  html=html.replace('</head>','<style>'+css+'</style></head>')
  page.set_content(html,wait_until='domcontentloaded')
  page.add_script_tag(content="Object.defineProperty(window,'localStorage',{configurable:true,value:{m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,v)},removeItem(k){this.m.delete(k)}}});"+mock+'\n'+fetch_mock)
  page.add_script_tag(content=(root/'shared/client.js').read_text())
  if kind=='tv':page.add_script_tag(content=(root/'tv/board-view.js').read_text())
  page.add_script_tag(content=(root/f'{kind}/{kind}.js').read_text())
  page.wait_for_timeout(500)
  players=[{'id':f'p{i}','name':f'Player {i}','avatarId':i,'seat':i,'ready':True,'online':True,'sparks': [4,3,3,2,1,0][i-1], 'position':[13,3,22,30,17,24][i-1]} for i in range(1,7)]
  minigame={'id':'odd-spot','category':'speed','title':'Odd Spot','rule':'Find the one different icon in a 6×6 grid. Wrong taps lock you for three seconds.', 'round':2,'totalRounds':5,'roundKey':2,'phase':'play','question':'Tap the different symbol!','hint':'','display':{'grid':['●']*21+['◆']+['●']*14},'deadline':int(time.time()*1000)+14000,'openAt':int(time.time()*1000), 'participants':[x['id'] for x in players],'eliminated':[], 'answered':[],'progress':{},'blocked':{},'scores':{x['id']:1 for x in players}}
  state={'code':'ABCD','phase':'board','hostOnline':True,'canStart':False,'settings':{'target':12,'timerSpeed':'normal','familyFriendly':True,'reduceMotion':False},'players':players,'serverNow':int(time.time()*1000),
   'board':{'turn':5,'activeId':'p1','rolls':[],'landing':13,'lastMove':None,'step':'minigame','event':{'type':'minigame','text':'NOGGIN Odd Spot mini-game!'},'minigame':minigame,'challenge':None,'leaderIds':['p1'],'finalists':[],'winnerIds':[],'history':[],'result':None,'paused':False,'deadline':minigame['deadline'],'nextAt':None}}
  if kind=='tv':page.evaluate('(data)=>window.__emitFake("room:state",data)',state)
  else:
   page.fill('#code','ABCD');page.fill('#playerName','Player 1');page.locator('.avatar-choice').first.click();page.locator('#joinButton').click();page.wait_for_timeout(100)
   page.evaluate('(data)=>window.__emitFake("room:state",data)',state)
  page.wait_for_timeout(300)
  path=Path('/mnt/data')/f'noggin-phase3-{name}.png';page.screenshot(path=str(path),full_page=True)
  metrics=page.evaluate('''()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
   boardVisible:!document.querySelector('#gameStage')?.classList.contains('hidden'), phoneGameVisible:!document.querySelector('#gameScreen')?.classList.contains('hidden'),
   boardSpaces:document.querySelectorAll('#boardSpaces .board-space').length,tokenCount:document.querySelectorAll('.stage-token').length,
   question:document.querySelector('#challengePrompt')?.textContent,phoneButtons:document.querySelectorAll('#gameButtons button').length})''')
  # Exercise the remaining seven Phase 3 game renderers on every viewport.
  modes=[
   ('quick-draw','wait','Wait for the signal…',{'readyAt':int(time.time()*1000)+3000},None),
   ('count-flash','flash','Watch the TV! Count the objects.',{'flashEndsAt':int(time.time()*1000)+2000},{'count':42,'icon':'⚽','seed':42}),
   ('colour-clash','play','RED',{'ink':'BLUE','word':'RED'},None),
   ('higher-lower','play','Boron: atomic number 5. Oxygen: higher or lower?',{'options':['HIGHER','LOWER']},None),
   ('memory-lane','flash','Watch the TV pads, then repeat.',{'padCount':6,'sequenceLength':3,'flashEndsAt':int(time.time()*1000)+3500},{'sequence':[0,4,3]}),
   ('close-call','play','How many seconds are in 18 minutes?',{'unit':'seconds'},None),
   ('unscramble','play','E C K T L E',{'hint':'Things and objects','wordLength':6,'revealAt':int(time.time()*1000)+2000},None),
  ]
  mini_metrics=[]
  for gid,phase,question,display,tvCue in modes:
   m={**minigame,'id':gid,'title':gid.replace('-',' ').title(),'phase':phase,'question':question,'display':display,'hint':display.get('hint','')}
   if tvCue and kind=='tv':m['tvCue']=tvCue
   teststate={**state,'board':{**state['board'],'minigame':m,'step':'minigame'}}
   page.evaluate('(data)=>window.__emitFake("room:state",data)',teststate)
   page.wait_for_timeout(40)
   mini_metrics.append({'game':gid,'buttons':page.locator('#gameButtons button').count() if kind=='play' else 0,'errorCount':len(errors)})
  metrics['additionalGamesRendered']=mini_metrics
  results.append({'screen':name,'metrics':metrics,'errors':errors,'screenshot':str(path)})
  ctx.close()
 browser.close()
print(json.dumps(results,indent=2))
if any(x['errors'] for x in results):raise SystemExit('Browser errors occurred')
