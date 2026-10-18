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
  page.wait_for_timeout(400)
  players=[{'id':f'p{i}','name':f'Player {i}','avatarId':i,'seat':i,'ready':True,'online':True,'sparks': [4,3,3,2,1,0][i-1], 'position':[13,3,22,30,17,24][i-1]} for i in range(1,7)]
  def game_state(gid,phase,display,question,private=None):
   now=int(time.time()*1000)
   m={'id':gid,'category':'create' if gid in ['sketch-sabotage','noise-annoys','caption-this','fib-factory'] else 'together',
   'title':gid.replace('-',' ').title(),'rule':'Explain the challenge in one sentence and play together on your phones.',
   'round':1,'totalRounds':3 if gid in ['mind-meld','majority-rules'] else 1,'roundKey':2,'phase':phase,
   'introUntil':now+4000,'question':question,'display':display,'deadline':now+50000,'openAt':now,
   'participants':[x['id'] for x in players],'answered':[],'voted':[],'scores':{x['id']:0 for x in players}}
   if private and kind=='play':m['private']=private
   return {'code':'ABCD','phase':'board','hostOnline':True,'canStart':False,'settings':{'target':12,'timerSpeed':'normal','familyFriendly':True,'reduceMotion':False},'players':players,'serverNow':now,
     'board':{'turn':5,'activeId':'p1','rolls':[],'landing':13,'lastMove':None,'step':'minigame','event':{'type':'minigame','text':gid},'minigame':m,
     'challenge':None,'leaderIds':['p1'],'finalists':[],'winnerIds':[],'history':[],'result':None,'paused':False,'deadline':now+50000,'nextAt':None}}
  if kind=='play':
   page.fill('#code','ABCD');page.fill('#playerName','Player 1');page.locator('.avatar-choice').first.click();page.locator('#joinButton').click();page.wait_for_timeout(150)
  cases=[
   ('sketch-sabotage','play',{'category':'Garden','strokes':[{'points':[[100,100],[300,400],[400,500]]}],'maxSaboteurStrokes':3},'DRAW · Garden',{'role':'artist','word':'WHEELBARROW'}),
   ('noise-annoys','play',{},'Listen to the performer',{'role':'performer','clue':'an old kettle coming to the boil'}),
   ('caption-this','play',{'avatars':[1,8],'scene':'The Judge loses his wig in a bouncy castle','entryCount':2},'The Judge loses his wig in a bouncy castle'),
   ('caption-this','vote',{'options':['The wig is free!','Who ordered pudding?','A hot air lawyer']},'The Judge loses his wig in a bouncy castle',{'myEntryIndex':1}),
   ('fib-factory','play',{'entryCount':1},'A chessboard contains ___ squares'),
   ('fib-factory','vote',{'options':['64','36','100']},'A chessboard contains ___ squares',{'myEntryIndex':2}),
   ('mind-meld','partner',{'category':'Things found on a beach','partners':['p2','p3','p4','p5','p6']},'Category: beach'),
   ('mind-meld','play',{'category':'Things found on a beach','partnerId':'p2','attempt':1},'Category: beach'),
   ('majority-rules','play',{'options':['Digestive','Rich Tea','Hobnob','Custard Cream']},'Best biscuit to dunk?'),
   ('relay-sums','play',{'teams':[['p1','p3','p5'],['p2','p4','p6']],'progress':[3,2],'totals':[6,6],'activeIds':['p3','p4']},'Two teams race!',None),
   ('bomb-squad','play',{'wires':['RED','BLUE','GREEN','YELLOW'],'cut':['BLUE'],'keypadReady':False},'Share private phone clues',{'clues':['Clue A: FIRST wire BLUE. FIRST keypad digit is 9.'],'role':'defuser'}),
   ('bomb-squad','play',{'wires':['RED','BLUE','GREEN','YELLOW'],'cut':['BLUE','GREEN','RED','YELLOW'],'keypadReady':True},'Enter the code',{'clues':['Clue A: FIRST wire BLUE. FIRST keypad digit is 9.'],'role':'defuser'})
  ]
  snapshots=[]
  for case in cases:
   gid,phase,display,question=case[:4];private=case[4] if len(case)>4 else None
   state=game_state(gid,phase,display,question,private)
   page.evaluate('(data)=>window.__emitFake("room:state",data)',state)
   page.wait_for_timeout(75)
   visible=page.locator('#gameScreen').is_visible() if kind=='play' else page.locator('#gameStage').is_visible()
   metrics=page.evaluate('''()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
   buttons:document.querySelectorAll('#gameButtons button').length,drawCanvas:document.querySelectorAll('.sketch-canvas').length,
   tvCanvas:document.querySelectorAll('.tv-sketch').length,optionCount:document.querySelectorAll('#challengeChoices .p4-ballot').length})''')
   snapshots.append({'id':gid,'phase':phase,'visible':visible,'metrics':metrics})
   if not visible:raise AssertionError((kind,name,gid,'game not visible'))
   if metrics['scrollWidth']>w+2:raise AssertionError((kind,name,gid,'horizontal overflow',metrics))
   if errors:raise AssertionError((kind,name,gid,errors))
   if gid=='sketch-sabotage' and kind=='play' and not metrics['drawCanvas']:raise AssertionError('No interactive drawing pad')
   if gid=='sketch-sabotage':page.screenshot(path=str(Path('/mnt/data')/f'noggin-phase4-sketch-{name}.png'),full_page=True)
   if gid=='sketch-sabotage' and kind=='tv' and not metrics['tvCanvas']:raise AssertionError('No live TV sketch canvas')
   if gid=='bomb-squad' and phase=='play' and display['keypadReady']:
    path=Path('/mnt/data')/f'noggin-phase4-{name}.png';page.screenshot(path=str(path),full_page=True)
  results.append({'screen':name,'gamesRendered':len(snapshots),'errors':errors,'snapshots':snapshots})
  ctx.close()
 browser.close()
path=Path('/mnt/data/NOGGIN-Phase-4/phase4-browser-results.json');path.write_text(json.dumps(results,indent=2))
print(json.dumps([{'screen':r['screen'],'tested':r['gamesRendered'],'errors':r['errors']} for r in results],indent=2))
