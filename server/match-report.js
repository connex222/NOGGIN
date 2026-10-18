'use strict';
// Local-only, privacy-minimal match performance report. Do not store player
// names, room credentials, answers, drawing strokes, or IP addresses here.
const TRACKED_STEPS = new Set(['await_roll','choose_die','choose_route','choose_target','choose_opponent','choose_category','minigame','showdown','challenge','result','finished']);
function start(room, now) {
  room.matchReport = {
    version: 1, startedAt: now, lastObservedAt: now,
    lastStep: room.board?.step || 'await_roll', lastPaused: false,
    lastRoundKey: null, lastChallengeKey: null, lastResultKey: null,
    stageMs: {}, pauseMs: 0, games: {}, showdowns: {}, outcomes: 0, skips: 0,
    turns: 1, finishedAt: null
  };
}
function observe(room, now) {
  const m=room.matchReport,b=room.board;
  if (!m||!b||!Number.isFinite(now)) return;
  const delta=Math.max(0,Math.min(now-m.lastObservedAt,86_400_000));
  if (m.lastPaused) m.pauseMs+=delta;
  else if (TRACKED_STEPS.has(m.lastStep)) m.stageMs[m.lastStep]=(m.stageMs[m.lastStep]||0)+delta;
  m.lastObservedAt=now;m.lastPaused=Boolean(b.pausedAt);m.lastStep=b.step;
  m.turns=Math.max(m.turns,Number(b.turn)||1);
  if(b.step==='minigame'&&b.minigame){
    const key=`${b.turn}/${b.minigame.id}`;
    if(key!==m.lastRoundKey){m.games[b.minigame.id]=(m.games[b.minigame.id]||0)+1;m.lastRoundKey=key;}
  }
  if(b.step==='showdown'&&b.showdown){
    const key=`${b.turn}/${b.showdown.kind}`;
    if(key!==m.lastChallengeKey){m.showdowns[b.showdown.kind]=(m.showdowns[b.showdown.kind]||0)+1;m.lastChallengeKey=key;}
  }
  if(b.step==='result'&&b.result){
    const key=`${b.turn}/${b.result.text}`;
    if(key!==m.lastResultKey){m.outcomes++;if(/disconnected\. Their turn was skipped\./.test(b.result.text))m.skips++;m.lastResultKey=key;}
  }
  if(room.phase==='finished'&&!m.finishedAt)m.finishedAt=now;
}
function report(room,now){
  observe(room,now);
  const m=room.matchReport;
  if(!m) return null;
  const duration=Object.values(m.stageMs).reduce((a,b)=>a+b,0);
  const waiting=['await_roll','choose_die','choose_route','choose_target','choose_opponent','choose_category','result'].reduce((a,k)=>a+(m.stageMs[k]||0),0);
  return {
    schema:'noggin.match-report.v1', version:require('../package.json').version,
    startedAt:new Date(m.startedAt).toISOString(),finished:room.phase==='finished',
    playerCount:room.players.length,turnsReached:m.turns,resultsShown:m.outcomes,
    wallTimeSeconds:Math.round((Math.max(0,(m.finishedAt||now)-m.startedAt))/1000),
    activeSeconds:Math.round(duration/1000),pausedSeconds:Math.round(m.pauseMs/1000),
    waitingSeconds:Math.round(waiting/1000),waitingPercent:duration?Math.round(waiting/duration*100):0,
    meanTurnSeconds:m.outcomes?Math.round(duration/1000/m.outcomes):null,
    skippedDisconnectedTurns:m.skips,
    stagesSeconds:Object.fromEntries(Object.entries(m.stageMs).map(([k,v])=>[k,Math.round(v/1000)])),
    miniGames:{...m.games},showdowns:{...m.showdowns},
    note:'Local server measurements, not player enjoyment ratings. No player names, answers, IPs or session tokens are included.'
  };
}
module.exports={start,observe,report};
