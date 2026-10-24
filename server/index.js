'use strict';
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const {Server} = require('socket.io');
const QRCode = require('qrcode');
const {attachGateway} = require('./gateway');
const {GameRooms} = require('./rooms');
const stateStore=require('./state-store');
const {allLanAddresses} = require('./network');
const {listenWithFallback} = require('./port-listener');
const fs = require('node:fs');
const {execFile} = require('node:child_process');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Boolean(process.env.RENDER || process.env.TRUST_PROXY === '1') ? 1 : false);
app.use((req,res,next) => {
  res.set('X-Content-Type-Options','nosniff');
  res.set('Referrer-Policy','no-referrer');
  res.set('X-Frame-Options','DENY');
  // WebSocket connections are same-origin; all assets are local.
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss:; base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
  next();
});
const publicDir = path.join(__dirname,'..','public');
app.get('/', (req,res) => res.redirect('/tv/'));
// Express 4 routes ignore trailing slashes by default. Exact-match redirects
// prevent /tv/ and /play/ from endlessly redirecting to themselves.
app.get(/^\/tv$/, (req,res) => res.redirect('/tv/'));
app.get(/^\/play$/, (req,res) => res.redirect('/play/'));
app.get('/health', (req,res) => res.json({ok:true, game:'NOGGIN', phase:'stable-development', version:require('../package.json').version}));
// Host voice: the manifest is built live from whatever recordings are in public/voice,
// so adding a line is just dropping a file into that folder.
app.get('/voice/voice-manifest.json', (req,res) => {const {takes}=require('./voice').scan();res.set('Cache-Control','no-store').json({lines:takes});});
app.use(express.static(publicDir,{dotfiles:'deny',maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0}));
app.use((req,res) => res.status(404).send('Not found'));
const server = http.createServer(app);
const io = new Server(server,{serveClient:true,transports:['websocket','polling'],maxHttpBufferSize:64*1024,connectionStateRecovery:{maxDisconnectionDuration:30_000}});
const rooms=new GameRooms();
const stateFile=process.env.NOGGIN_STATE_FILE||'';
if(stateFile){try{console.log(`Restored ${stateStore.restore(rooms,stateFile)} saved room(s).`);}catch(e){console.error('Checkpoint restore failed:',e.message);}}
attachGateway(io,{QRCode,rooms});
if(stateFile){
  const checkpoint=()=>{try{stateStore.save(rooms,stateFile);}catch(e){console.error('Checkpoint failed:',e.message);}};
  const checkpointTimer=setInterval(checkpoint,5000);checkpointTimer.unref?.();
  process.on('SIGTERM',()=>{checkpoint();server.close(()=>process.exit(0));});
  process.on('SIGINT',()=>{checkpoint();server.close(()=>process.exit(0));});
}
listenWithFallback(server, {
  port: Number(process.env.PORT) || 3000,
  // Only the local Windows launcher enables automatic port changes.
  // Render and Oracle must listen on their configured deployment port.
  autoFallback: process.env.NOGGIN_AUTO_PORT === '1' && !process.env.RENDER && process.env.NODE_ENV !== 'production',
  onRetry: (busy, next) => console.warn(`Port ${busy} is in use. Trying port ${next} instead...`),
  onListening: port => {
    process.env.NOGGIN_ACTIVE_PORT = String(port);
    console.log('');
    console.log('=========================================');
    console.log('NOGGIN SERVER IS RUNNING');
    console.log(`OPEN THIS TV ADDRESS: http://localhost:${port}/tv/`);
    const ip = allLanAddresses()[0];
    if (ip) console.log(`PHONES ON THE SAME NETWORK: http://${ip}:${port}/play/`);
    console.log('=========================================');
    console.log('Leave this window open while playing.');
    // Only the local Windows .bat launcher enables these convenience features.
    // Public hosts (Render / Oracle / Docker) never launch browsers or change ports.
    if (process.env.NOGGIN_PORT_FILE && process.env.NOGGIN_OPEN_BROWSER === '1' && process.platform === 'win32') {
      try {
        fs.mkdirSync(path.dirname(process.env.NOGGIN_PORT_FILE), {recursive: true});
        fs.writeFileSync(process.env.NOGGIN_PORT_FILE, String(port) + '\n', 'utf8');
      } catch (error) {
        console.warn('Could not write the active-port file:', error.message);
      }
    }
    if (process.env.NOGGIN_OPEN_BROWSER === '1' && process.platform === 'win32') {
      const tvUrl = `http://localhost:${port}/tv/`;
      execFile('cmd.exe', ['/d', '/s', '/c', `start "" "${tvUrl}"`], {windowsHide:true, timeout:10000}, error => {
        if (error) console.warn(`Could not open the browser automatically. Open ${tvUrl} yourself.`);
      });
    }
  },
  onFailure: (error, port) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Could not start: port ${port} is already occupied.`);
      console.error('Close another game server or run NOGGIN with a different PORT.');
    } else {
      console.error(`Could not start NOGGIN: ${error.message}`);
    }
    process.exitCode = 1;
    process.exit(1);
  },
});
