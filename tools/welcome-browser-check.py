"""Headless TV welcome UI smoke check. Replaces socket network with a minimal mock; not a live-game test."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, threading, http.server, socketserver
ROOT=Path(__file__).resolve().parent.parent
PORT=9189
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
 def do_GET(self):
  if self.path.startswith('/socket.io/socket.io.js'):
   b=b'''window.io=function(){let h={};const socket={connected:true,on:(k,fn)=>(h[k]=fn,socket),timeout:()=>socket,emit:(name,payload,cb)=>{let state={code:'BRAIN',phase:'lobby',players:[],settings:{target:12,timerSpeed:'normal',familyFriendly:true,reduceMotion:false},canStart:false};let out={ok:true,code:'ABCD',token:'secret',state,joinUrl:'http://192.168.0.20:3100/play/?room=ABCD',qrDataUrl:'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E'};if(name==='room:resume')out={ok:false,message:'No session'};setTimeout(()=>cb(null,out),5)}};setTimeout(()=>h.connect&&h.connect(),100);return socket};'''
   self.send_response(200);self.send_header('Content-Type','application/javascript');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
  return super().do_GET()
from PIL import Image
import base64,io,re
PUBLIC=ROOT/'public'
avatars=json.loads((PUBLIC/'shared/avatars.json').read_text())
for a in avatars:
 for expr in ('think','win','lose'):
  img=Image.open(PUBLIC/a['images'][expr].lstrip('/')).convert('RGBA');img.thumbnail((115,115))
  out=io.BytesIO();img.save(out,format='WEBP',quality=75)
  a['images'][expr]='data:image/webp;base64,'+base64.b64encode(out.getvalue()).decode()
 a['think']=a['images']['think']
html=(PUBLIC/'tv/index.html').read_text()
html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>', '', html)
html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>', '', html)
css='\n'.join((PUBLIC/f).read_text() for f in ['shared/theme.css','tv/tv.css','tv/welcome.css'])
html=html.replace('</head>','<style>'+css+'</style></head>')
MOCK="""window.io=function(){let h={};const socket={connected:true,on:(k,fn)=>(h[k]=fn,socket),timeout:()=>socket,emit:(name,payload,cb)=>{let state={code:'ABCD',phase:'lobby',players:[],settings:{target:12,timerSpeed:'normal',familyFriendly:true,reduceMotion:false},canStart:false};let out={ok:true,code:'ABCD',token:'secret',state,joinUrl:'http://192.168.0.20:3100/play/?room=ABCD',qrDataUrl:'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E'};if(name==='room:resume')out={ok:false,message:'No session'};setTimeout(()=>cb(null,out),5)}};setTimeout(()=>h.connect&&h.connect(),100);return socket};"""
MOCKFETCH='window.fetch=async()=>({ok:true,json:async()=>'+json.dumps(avatars)+'});'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for width,height in [(1280,720),(1920,1080),(360,640)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  errors=[];page.on('pageerror', lambda e:errors.append(str(e)))
  def show():
   page.goto('about:blank')
   page.set_content(html)
   page.add_script_tag(content="Object.defineProperty(window,'localStorage',{configurable:true,value:{m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,v)},removeItem(k){this.m.delete(k)}}});")
   page.add_script_tag(content=MOCK+'\n'+MOCKFETCH)
   for f in ['shared/client.js','tv/sound.js','tv/board-view.js','tv/tv.js','tv/welcome.js']:
    page.add_script_tag(content=(PUBLIC/f).read_text())
   page.locator('#welcomeCast img').first.wait_for(timeout=4000)
  show();page.wait_for_timeout(200)
  before=page.locator('#welcomeCast img').evaluate_all('(xs)=>xs.map(x=>x.src)')
  print('SIZE',width,height,'frames',len(before),'overflow',page.evaluate('document.documentElement.scrollWidth-innerWidth'),'errors',errors)
  assert len(before)==12
  if width==1280:
   page.screenshot(path='/mnt/data/NOGGIN-Welcome-v1.3/welcome-1280.png',full_page=True)
   show();after=page.locator('#welcomeCast img').evaluate_all('(xs)=>xs.map(x=>x.src)');print('RANDOMIZED',sum(a!=b for a,b in zip(before,after)),'of 12');assert any(a!=b for a,b in zip(before,after))
   page.locator('#welcomeHowTo').click();assert page.locator('#welcomeRulesDialog').is_visible();page.locator('#welcomeRulesClose').click();assert not page.locator('#welcomeRulesDialog').is_visible()
   page.locator('#welcomeStart').click();page.wait_for_timeout(300);assert not page.locator('#welcomeScreen').is_visible();assert page.locator('#lobbyGrid').is_visible()
  if width==1920:page.screenshot(path='/mnt/data/NOGGIN-Welcome-v1.3/welcome-1920.png',full_page=True)
  assert not errors,errors
  page.close()
 browser.close()
