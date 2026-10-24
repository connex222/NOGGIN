'use strict';
// Optional local checkpoint for a SINGLE running Node process. Not a cross-server sync mechanism.
const fs=require('node:fs'),path=require('node:path');
const MAX_AGE_MS=24*60*60*1000;
function shiftTimes(b,delta){
 for(const key of ['deadline','nextAt','pausedAt'])if(typeof b[key]==='number')b[key]+=delta;
 for(const obj of [b.challenge,b.showdown,b.minigame])if(obj){for(const key of ['deadline','hardStop','openAt','introUntil','startedAt','stageStarted'])if(typeof obj[key]==='number')obj[key]+=delta;}
 if(b.minigame?.display){for(const key of ['readyAt','flashEndsAt','revealAt'])if(typeof b.minigame.display[key]==='number')b.minigame.display[key]+=delta;}
}
function restore(rooms,filename,now=Date.now()){
 if(!filename||!fs.existsSync(filename))return 0;
 const data=JSON.parse(fs.readFileSync(filename,'utf8'));
 if(data.format!==1||!Array.isArray(data.rooms)||!Number.isFinite(data.savedAt))throw Error('Unrecognized room checkpoint format');
 if(now-data.savedAt>MAX_AGE_MS)return 0;
 const delta=Math.max(0,now-data.savedAt);
 let count=0;
 for(const room of data.rooms){
   if(!room||typeof room.code!=='string'||!/^[A-Z2-9]{4}$/.test(room.code)||!Array.isArray(room.players))continue;
   room.hostSocketId=null;room.updatedAt=now;
   for(const person of room.players){person.socketId=null;person.offlineSince=now;}
   if(room.phase==='board'&&room.board){shiftTimes(room.board,delta);room.board.pausedAt=now;if(room.board.pauseKind!=='manual'){room.board.pauseKind='host';room.board.pauseReason='Waiting for the TV host to resume the saved game.';}}
   // The server was offline: never charge downtime to active gameplay metrics.
   if(room.matchReport){room.matchReport.lastObservedAt=now;room.matchReport.lastPaused=room.phase==='board';}
   rooms.rooms.set(room.code,room);count++;
 }
 return count;
}
function save(rooms,filename,now=Date.now()){
 if(!filename)return false;
 const dir=path.dirname(filename);fs.mkdirSync(dir,{recursive:true});
 const tmp=`${filename}.tmp`;
 // Account for live activity at the checkpoint boundary, not when reading state.
 for (const room of rooms.rooms.values()) require('./match-report').observe(room, now);
 const data=JSON.stringify({format:1,savedAt:now,rooms:[...rooms.rooms.values()]});
 fs.writeFileSync(tmp,data,{encoding:'utf8',mode:0o600});fs.renameSync(tmp,filename);
 return true;
}
module.exports={restore,save};
