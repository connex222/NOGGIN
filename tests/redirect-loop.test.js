'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');

test('TV and phone redirects only match paths WITHOUT trailing slash',()=>{
  const source=fs.readFileSync(path.join(root,'server/index.js'),'utf8');
  for(const [route,target] of [['tv','/tv/'],['play','/play/']]){
    // Check the production server contains an exact anchored route, and
    // cannot match its own redirect destination.
    const signature=`app.get(/^\\/${route}$/, (req,res) => res.redirect('${target}'));`;
    assert.ok(source.includes(signature),`Missing exact ${route} redirect`);
    const matcher=new RegExp(`^/${route}$`);
    assert.equal(matcher.test(`/${route}`),true);
    assert.equal(matcher.test(target),false);
    assert.ok(fs.existsSync(path.join(root,'public',route,'index.html')));
  }
});

const hasDeps=['express','socket.io','qrcode'].every(name=>{
  try{require.resolve(name,{paths:[root]});return true;}catch{return false;}
});

test('live server serves TV and phones without redirect loops',
  {skip: !hasDeps && 'Run npm install first to enable HTTP integration test',timeout:20000},async()=>{
    const listener=net.createServer();
    await new Promise((resolve,reject)=>listener.once('error',reject).listen(0,'127.0.0.1',resolve));
    const port=listener.address().port;
    await new Promise(resolve=>listener.close(resolve));
    const child=spawn(process.execPath,['server/index.js'],{
      cwd:root,
      env:{...process.env,PORT:String(port),NOGGIN_AUTO_PORT:'0',NOGGIN_OPEN_BROWSER:'0',NOGGIN_STATE_FILE:'',NODE_ENV:'test'},
      stdio:['ignore','pipe','pipe'],windowsHide:true,
    });
    let output='';
    child.stdout.on('data',b=>output+=b.toString());
    child.stderr.on('data',b=>output+=b.toString());
    const request=async route=>fetch(`http://127.0.0.1:${port}${route}`,{redirect:'manual',signal:AbortSignal.timeout(2200)});
    try{
      let ready=false;
      for(let i=0;i<50;i++){
        if(child.exitCode!==null) throw Error('Server exited: '+output);
        try{const r=await request('/health');if(r.ok){ready=true;break;}}catch{}
        await new Promise(r=>setTimeout(r,140));
      }
      assert.ok(ready,'Server never became ready: '+output);
      for(const route of ['/tv/','/play/','/check/']){
        const response=await request(route);
        assert.equal(response.status,200,`${route} should serve HTML, not a redirect`);
        assert.match(response.headers.get('content-type')||'',/text\/html/);
        assert.match(await response.text(),/<!doctype html|<html/i);
      }
      for(const route of ['/tv','/play']){
        const response=await request(route);
        assert.equal(response.status,302,`${route} should redirect just once`);
        assert.equal(response.headers.get('location'),route+'/');
      }
      const home=await request('/');
      assert.equal(home.status,302);
      assert.equal(home.headers.get('location'),'/tv/');
    }finally{
      child.kill();
    }
  });
