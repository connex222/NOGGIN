"""Mock-socket BROWSER LAYOUT checks only. This is NOT a live Socket.IO integration test."""
import json,time,base64,re
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/previews';OUT.mkdir(parents=True,exist_ok=True)
MOCK=r'''(()=>{
 const lobby={code:'ABCD',phase:'lobby',hostOnline:true,canStart:true,minPlayers:2,maxPlayers:8,settings:{target:12,timerSpeed:'normal',reduceMotion:false,familyFriendly:true,rules:'classic'},players:[{id:'p1',name:'Player 1',avatarId:1,seat:1,ready:true,online:true,sparks:0,cues:0,position:0}],serverNow:Date.now(),board:null};
 window.io=()=>{
  let handlers={};let sock={connected:true,on(n,fn){handlers[n]=fn;return sock},timeout(){return sock},disconnect(){sock.connected=false},emit(n,args,cb){
    let result={ok:true,state:lobby};
    if(n==='room:create')result={ok:true,code:'ABCD',token:'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',state:lobby,joinUrl:'http://192.168.1.22:3000/play/?room=ABCD',qrDataUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="150" height="150" fill="white"/%3E%3C/svg%3E'};
    if(n==='room:resume')result={ok:true,state:lobby,code:'ABCD',role:'player',playerId:'p1'};
    if(n==='room:peek')result={ok:true,state:lobby};
    if(n==='room:join')result={ok:true,state:lobby,code:'ABCD',token:'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',playerId:'p1'};
    setTimeout(()=>cb?.(null,result),2);
  }};
  window.__emitFake=(state)=>handlers['room:state']?.(state);
  setTimeout(()=>handlers.connect?.(),50);return sock;
 };
})();'''
avatars=json.loads((ROOT/'public/shared/avatars.json').read_text())
for avatar in avatars:
 for key in ('think','win','lose'):
  link=avatar['think'] if key=='think' else avatar['images'][key]
  data='data:image/webp;base64,'+base64.b64encode((ROOT/'public'/link.lstrip('/')).read_bytes()).decode('ascii')
  if key=='think':avatar['think']=data
  else:avatar['images'][key]=data
board_data=json.loads((ROOT/'public/shared/board-data.json').read_text())
fetch_mock='window.fetch=async (url)=>({ok:true,json:async ()=>(String(url).includes("avatars.json")?'+json.dumps(avatars)+':String(url).includes("board-data.json")?'+json.dumps(board_data)+':({files:[],music:{}}))});'
store="Object.defineProperty(window,'localStorage',{configurable:true,value:{m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,v)},removeItem(k){this.m.delete(k)}}});"
def load_html(kind):
 html=(ROOT/f'public/{kind}/index.html').read_text()
 html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html)
 html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',html)
 style=(ROOT/'public/shared/theme.css').read_text()+'\n'+(ROOT/f'public/{kind}/{kind}.css').read_text()
 if kind=='tv':style+='\n'+(ROOT/'public/tv/showcase.css').read_text()
 for filename in ['lato-regular.woff2','cabin-bold.woff2']:
  blob=base64.b64encode((ROOT/'public/shared/fonts'/filename).read_bytes()).decode('ascii')
  style=style.replace('/shared/fonts/'+filename,'data:font/woff2;base64,'+blob)
 return html.replace('</head>','<style>'+style+'</style></head>')
def state(players=4,scenario='board',rules='classic'):
 people=[{'id':f'p{i+1}','name':f'Player {i+1}','avatarId':i+1,'seat':i+1,'ready':True,'online':True,'position':[0,12,12,12,21,30,26,1][i],'sparks':[8,5,4,2,1,0,3,2][i],'cues':0} for i in range(players)]
 b={'step':'await_roll','turn':5,'activeId':'p1','rolls':[],'routePlan':False,'routeOptions':[],'headline':False,'lastMove':None,'landing':0,'event':{'type':'turn','text':'Player 1 rolls the dice'},'deadline':None,'nextAt':None,'challenge':None,'showdown':None,'minigame':None,'result':None,'leaderIds':['p1'],'finalists':[],'winnerIds':[],'history':[],'paused':False}
 if scenario in ['odd-phone','odd-tv']:
  b['step']='minigame'; b['event']={'type':'minigame','text':'Odd Spot: look at the TV'}
  symbols=['●']*36;symbols[25]='◆'
  b['minigame']={'id':'odd-spot','category':'speed','title':'Odd Spot','rule':'Find the one different icon on the TV, then tap its NUMBER on your phone','round':1,'totalRounds':5,'roundKey':1,'phase':'play','question':'Look at the TV! Tap the number of the different symbol.','hint':'','display':{'grid':symbols} if scenario=='odd-tv' else {},'deadline':int(time.time()*1000)+8500,'openAt':int(time.time()*1000)-100,'participants':[x['id'] for x in people],'eliminated':[],'answered':[],'progress':{},'scores':{},'strikes':{},'blocked':{}}
 elif scenario=='sketch':
  b['step']='minigame';b['event']={'type':'minigame','text':'Sketch & Sabotage'}
  b['minigame']={'id':'sketch-sabotage','category':'create','title':'Sketch & Sabotage','rule':'Draw, guess, sabotage','round':1,'totalRounds':1,'roundKey':1,'phase':'play','question':'Sketch on your phone','display':{'category':'Animals','strokes':[]},'deadline':int(time.time()*1000)+8500,'openAt':int(time.time()*1000)-100,'participants':[x['id'] for x in people],'answered':[],'scores':{},'blocked':{}}
 return {'code':'ABCD','phase':'board','hostOnline':True,'canStart':False,'settings':{'target':12,'familyFriendly':True,'timerSpeed':'normal','reduceMotion':False,'rules':rules},'players':people,'serverNow':int(time.time()*1000),'board':b}

def metrics(page):
 return page.evaluate('''()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;let b=e.getBoundingClientRect();return {left:Math.round(b.left),right:Math.round(b.right),top:Math.round(b.top),bottom:Math.round(b.bottom),width:Math.round(b.width),height:Math.round(b.height)}};
 const visibleButtons=[...document.querySelectorAll('#gameButtons button')].filter(e=>e.getBoundingClientRect().height>0);return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,board:R('#boardGraphic'),boardCentre:R('#boardCentre'),stage:R('.board-container'),challenge:R('#challengePanel'),canvas:R('.tv-sketch'),phoneGrid:R('.mini-grid'),phoneButtons:visibleButtons.length,smallTapTargets:visibleButtons.filter(e=>e.getBoundingClientRect().height<44||e.getBoundingClientRect().width<44).length,tokens:document.querySelectorAll('.stage-token').length,spaces:document.querySelectorAll('.board-space').length,fonts:document.fonts.check('16px "Noggin Body"')};}''')
records=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 def open_page(w,h,kind):
  ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1)
  page=ctx.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append('Page exception: '+str(e)))
  page.on('console',lambda m: errors.append('Console error: '+m.text) if m.type=='error' else None)
  page.set_content(load_html(kind),wait_until='domcontentloaded')
  page.add_script_tag(content=store)
  if kind=='play':
   page.evaluate("localStorage.setItem('noggin-player-session-v1',JSON.stringify({code:'ABCD',token:'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',playerId:'p1',name:'Player 1',avatarId:1}))")
  page.add_script_tag(content=MOCK)
  page.add_script_tag(content=fetch_mock)
  page.add_script_tag(content=(ROOT/'public/shared/client.js').read_text())
  if kind=='tv':
   page.add_script_tag(content=(ROOT/'public/tv/sound.js').read_text())
   page.add_script_tag(content=(ROOT/'public/tv/board-view.js').read_text())
  page.add_script_tag(content=(ROOT/f'public/{kind}/{kind}.js').read_text())
  page.wait_for_timeout(650)
  if kind=='tv': page.evaluate("document.querySelector('#welcomeScreen').classList.add('welcome-dismissed')")
  return page,ctx,errors
 for people in (4,8):
  for w,h in ((1920,1080),(1280,720)):
   page,ctx,errors=open_page(w,h,'tv');page.evaluate('(s)=>window.__emitFake(s)',state(people))
   page.wait_for_timeout(300);name=f'tv-board-{people}p-{w}x{h}.png';page.screenshot(path=str(OUT/name))
   records.append({'scenario':name,'metrics':metrics(page),'errors':errors});ctx.close()
 for w,h in ((360,640),(430,932)):
  page,ctx,errors=open_page(w,h,'play');page.evaluate('(s)=>window.__emitFake(s)',state(4,'odd-phone'))
  page.wait_for_timeout(300);name=f'phone-odd-spot-{w}x{h}.png';page.screenshot(path=str(OUT/name),full_page=True)
  records.append({'scenario':name,'metrics':metrics(page),'errors':errors});ctx.close()
 for w,h in ((1920,1080),(1280,720)):
  page,ctx,errors=open_page(w,h,'tv');page.evaluate('(s)=>window.__emitFake(s)',state(4,'sketch'))
  page.wait_for_timeout(300);name=f'tv-sketch-{w}x{h}.png';page.screenshot(path=str(OUT/name))
  records.append({'scenario':name,'metrics':metrics(page),'errors':errors});ctx.close()
 for w,h in ((1920,1080),(1280,720)):
  page,ctx,errors=open_page(w,h,'tv');page.evaluate('(s)=>window.__emitFake(s)',state(4,'odd-tv'))
  page.wait_for_timeout(300);name=f'tv-odd-spot-{w}x{h}.png';page.screenshot(path=str(OUT/name))
  records.append({'scenario':name,'metrics':metrics(page),'errors':errors});ctx.close()
 browser.close()

(OUT/'release-ui-mock-results.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps(records,indent=2))
