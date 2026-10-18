'use strict';
// Offline QA of files and data required for each distribution ZIP.
const fs=require('node:fs');
const path=require('node:path');
const board=require('../server/board');
const phase3=require('../server/games/phase3');
const phase4=require('../server/games/phase4');
const phase5=require('../server/games/phase5');
const avatars=require('../public/shared/avatars.json');
const ROOT=path.resolve(__dirname,'..');
const errors=[];const findings=[];
const need=(what,test)=>{if(!test)errors.push(what);else findings.push(what);};
const exists=p=>fs.existsSync(path.join(ROOT,p));
for(const p of ['package.json','Dockerfile','docker-compose.yml','render.yaml','start-noggin.bat','HOW-TO-PLAY.pdf','INSTALL.md','README.md','RELEASE-CHECKLIST.md','deploy/oracle/Caddyfile','public/tv/index.html','public/play/index.html'])need('File '+p,exists(p));
need('Board contains 36 spaces',board.SPACES.length===36);
need('Four Showdown corners',Object.keys(board.SHOWDOWNS).length===4);
need('Speed and Brain games 4 each',['speed','brain'].every(category=>Object.values(phase3.SPECS).filter(x=>x.category===category).length===4));
need('Create and Together games 4 each',['create','together'].every(category=>Object.values(phase4.SPECS).filter(x=>x.category===category).length===4));
need('Numeric Noggin-Off is present',typeof phase5.start==='function');
need('12 avatar descriptions',avatars.length===12);
for(const avatar of avatars){
 for(const state of ['think','win','lose']){
  const link=avatar.images[state];
  const img=path.join(ROOT,'public',link.replace(/^\//,''));
  if(!fs.existsSync(img)){errors.push('Missing runtime avatar '+link);continue;}
  const webp=fs.readFileSync(img).subarray(0,12);
  need('Fast WebP avatar '+avatar.id+' '+state,webp.toString('ascii',0,4)==='RIFF'&&webp.toString('ascii',8,12)==='WEBP');
  const archival=img.replace(/[\\/]thumbs[\\/]/,path.sep).replace(/\.webp$/,'.png');
  if(!fs.existsSync(archival)){errors.push('Missing archival PNG '+archival);continue;}
  const fd=fs.openSync(archival,'r');const b=Buffer.alloc(24);fs.readSync(fd,b,0,b.length,0);fs.closeSync(fd);
  need('Original PNG '+avatar.id+' '+state,b.toString('ascii',1,4)==='PNG'&&b.readUInt32BE(16)===1024&&b.readUInt32BE(20)===1024);
 }
}
for(const [name,n] of Object.entries({'higher-lower':150,'close-call':60,'unscramble':120,'sketch-words':200,'noise-clues':80,'caption-scenes':30,'fib-facts':60,'mind-categories':60,'majority-questions':60,'buzzer-questions':100,'bid-categories':40})){
 const rows=require(path.join(ROOT,'data',name+'.json'));
 need(name+' '+n+' entries',Array.isArray(rows)&&rows.length===n);
}
const html=['public/tv/index.html','public/play/index.html'].map(p=>fs.readFileSync(path.join(ROOT,p),'utf8')).join('\n');
need('No external CDN or script assets in HTML',!/<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(html));
const pkg=require('../package.json');
need('Node v20+ runtime declaration',pkg.engines.node==='>=20');
need('Express and Socket.IO dependencies available in manifest',Boolean(pkg.dependencies.express&&pkg.dependencies['socket.io']&&pkg.dependencies.qrcode));
const pending=require('../data/fib-facts.json').filter(x=>x.editorialStatus==='review-pending').length;
const report={version:pkg.version,ok:errors.length===0,checks:findings.length+errors.length,errors,editorialReviewPending:pending,note:'Static release audit only; does not replace npm install, live WebSocket or cross-network device tests.'};
console.log(JSON.stringify(report,null,2));
process.exitCode=errors.length?1:0;
