'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {listenWithFallback} = require('../server/port-listener');

function startFreeServer() {
  const server = http.createServer((_req, res) => res.end('busy'));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
function close(server) {
  return new Promise(resolve => server.close(() => resolve()));
}

test('occupied port is skipped and advertised PORT matches the selected port', async () => {
  const oldPort = process.env.PORT;
  const blocker = await startFreeServer();
  const initialPort = blocker.address().port;
  const server = http.createServer((_req, res) => res.end('NOGGIN'));
  try {
    const result = await new Promise((resolve, reject) => {
      const retries=[];
      listenWithFallback(server, {
        port:initialPort, host:'127.0.0.1', autoFallback:true,
        onRetry:(from,to)=>retries.push([from,to]),
        onListening:port=>resolve({port,retries}),
        onFailure:reject,
      });
    });
    assert.ok(result.port > initialPort);
    assert.equal(result.retries[0][0], initialPort);
    assert.equal(process.env.PORT, String(result.port));
    const response = await fetch(`http://127.0.0.1:${result.port}/`);
    assert.equal(await response.text(), 'NOGGIN');
  } finally {
    await close(server);
    await close(blocker);
    if (oldPort === undefined) delete process.env.PORT;
    else process.env.PORT=oldPort;
  }
});

test('an occupied port fails without fallback (Render/Oracle mode)', async () => {
  const oldPort=process.env.PORT;
  const blocker=await startFreeServer();
  const server=http.createServer();
  try {
    const outcome=await new Promise(resolve=>{
      listenWithFallback(server,{
        port:blocker.address().port,host:'127.0.0.1',autoFallback:false,
        onListening:()=>resolve({error:false}),
        onFailure:e=>resolve({error:e.code}),
      });
    });
    assert.equal(outcome.error,'EADDRINUSE');
  } finally {
    await close(blocker);
    if(oldPort===undefined) delete process.env.PORT;
    else process.env.PORT=oldPort;
  }
});
