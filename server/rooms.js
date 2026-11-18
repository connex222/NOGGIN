'use strict';

const crypto = require('node:crypto');
const avatars = require('../public/shared/avatars.json');
const board = require('./board');
const {enforceFamilyText} = require('./content-filter');
const matchReport = require('./match-report');

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const AVATAR_IDS = new Set(avatars.map(a => a.id));
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
const SEAT_GRACE_MS = 30_000;
// D4: phones auto-lock while people wait in the lobby, so a lobby seat (name,
// avatar, ready state) is held for 10 minutes. In-game turns still use 30 s.
const LOBBY_GRACE_MS = 10 * 60_000;
const EMPTY_ROOM_TTL_MS = 60 * 60_000;
const MAX_ROOMS = 500;

class LobbyError extends Error {
  constructor(code, message) { super(message); this.name = 'LobbyError'; this.code = code; }
}

function assert(condition, code, message) {
  if (!condition) throw new LobbyError(code, message);
}

function normalizeName(value) {
  assert(typeof value === 'string', 'NAME', 'Enter your name.');
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  assert(name.length >= 2 && name.length <= 20 && !/[<>\u0000-\u001f\u007f]/u.test(name), 'NAME', 'Use a name between 2 and 20 characters without symbols like < or >.');
  return name;
}

function normalizeCode(value) {
  assert(typeof value === 'string' && /^[A-Za-z2-9]{4}$/.test(value), 'ROOM', 'Check the four-character room code.');
  return value.toUpperCase();
}

function safeTokenEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[a-zA-Z0-9_-]{32}$/.test(a) || !/^[a-zA-Z0-9_-]{32}$/.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

class GameRooms {
  constructor({now = () => Date.now(), randomInt = crypto.randomInt} = {}) {
    this.now = now;
    this.randomInt = randomInt;
    this.rooms = new Map();
  }

  newCode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let code = '';
      for (let i = 0; i < 4; i += 1) code += ROOM_CHARS[this.randomInt(ROOM_CHARS.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new LobbyError('CAPACITY', 'Could not allocate a room. Please retry.');
  }

  create(hostSocketId) {
    assert(this.rooms.size < MAX_ROOMS, 'CAPACITY', 'All studio rooms are busy; retry later.');
    const code = this.newCode();
    const room = {
      code, phase: 'lobby', createdAt: this.now(), updatedAt: this.now(),
      hostToken: crypto.randomBytes(24).toString('base64url'), hostSocketId,
      players: [], vipId: null, vipOfflineSince: null, settings: {rounds: board.DEFAULT_ROUNDS, familyFriendly: true, timerSpeed: 'relaxed', reduceMotion: false, rules: 'classic', roundStyle: 'everyone', colourBlindSafe: false, readyCheck: true}
    };
    this.rooms.set(code, room);
    return {code, token: room.hostToken, state: this.state(code, true)};
  }

  find(code) {
    const room = this.rooms.get(normalizeCode(code));
    assert(Boolean(room), 'ROOM', 'Room not found. Check the code on the TV.');
    return room;
  }

  state(code,forTv=false,viewerId=null) {
    const room = this.find(code);
    return {
      code: room.code, phase: room.phase, hostOnline: Boolean(room.hostSocketId),
      vipId: room.vipId || null, vipName: room.players.find(p => p.id === room.vipId)?.name || null, settings: {...room.settings}, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS,
      // D4: offline-but-ready players do not block the start; they reconnect into their seat.
      canStart: Boolean(room.hostSocketId) && room.players.length >= MIN_PLAYERS && room.players.every(p => p.ready) && room.players.some(p => p.socketId),
      serverNow: this.now(), board: board.publicBoard(room,forTv,viewerId),
      players: room.players.map(p => ({id: p.id, name: p.name, avatarId: p.avatarId, seat: p.seat, ready: p.ready, online: Boolean(p.socketId), position:p.position ?? 0, sparks:p.sparks ?? 0, cues:p.cues ?? 0}))
    };
  }

  join({code, name, avatarId, socketId}) {
    const room = this.find(code);
    assert(room.phase === 'lobby', 'PHASE', 'This room is already playing.');
    assert(room.players.length < MAX_PLAYERS, 'FULL', 'The room already has eight players.');
    const safeName = enforceFamilyText(room,normalizeName(name));
    assert(!room.players.some(p => p.name.toLocaleLowerCase() === safeName.toLocaleLowerCase()), 'DUP_NAME', 'That player name is already taken.');
    assert(Number.isInteger(avatarId) && AVATAR_IDS.has(avatarId), 'AVATAR', 'Choose an avatar first.');
    assert(!room.players.some(p => p.avatarId === avatarId), 'TAKEN', 'That avatar is already taken. Choose another.');
    assert(typeof socketId === 'string' && socketId.length > 0, 'SOCKET', 'Connection not ready.');
    const player = {
      id: crypto.randomUUID(), token: crypto.randomBytes(24).toString('base64url'),
      seat: Array.from({length: MAX_PLAYERS}, (_, i) => i + 1).find(seat => !room.players.some(p => p.seat === seat)),
      name: safeName, avatarId, ready: false, socketId, offlineSince: null
    };
    room.players.push(player);
    if (!room.vipId) room.vipId = player.id;
    room.updatedAt = this.now();
    return {code: room.code, playerId: player.id, token: player.token, state: this.state(room.code, false, player.id)};
  }

  resume({code, token, socketId, role}) {
    const room = this.find(code);
    assert(typeof socketId === 'string' && socketId.length > 0, 'SOCKET', 'Connection not ready.');
    if (role === 'host') {
      assert(safeTokenEquals(token, room.hostToken), 'AUTH', 'Your host session is no longer available.');
      const oldSocketId = room.hostSocketId;
      room.hostSocketId = socketId;
      room.updatedAt = this.now();
      return {code: room.code, role: 'host', oldSocketId, state: this.state(room.code, true)};
    }
    assert(role === 'player', 'AUTH', 'Invalid session.');
    const player = room.players.find(p => safeTokenEquals(token, p.token));
    assert(player, 'AUTH', 'Your previous seat is no longer available. Please join again.');
    if (room.phase === 'lobby' && !player.socketId && player.offlineSince !== null && this.now() - player.offlineSince > LOBBY_GRACE_MS) {
      room.players = room.players.filter(p => p !== player);
    if (room.vipId === player.id) {room.vipId = room.players.find(p => p.socketId)?.id || null; room.vipOfflineSince = null;}
      throw new LobbyError('EXPIRED', 'Your seat was held for 10 minutes and has now been released. Please join again.');
    }
    const oldSocketId = player.socketId;
    player.socketId = socketId;
    player.offlineSince = null;
    if (room.vipId === player.id) room.vipOfflineSince = null;
    room.updatedAt = this.now();
    return {code: room.code, role: 'player', playerId: player.id, oldSocketId, state: this.state(room.code, false, player.id)};
  }

  // D1: a phone may ask to resume twice on one connection. If this socket already
  // holds exactly the seat the token belongs to, confirm it instead of rejecting.
  confirmSeat({code, token, role, socketId}) {
    const room = typeof code === 'string' ? this.rooms.get(code.toUpperCase()) : null;
    if (!room || typeof socketId !== 'string' || !socketId) return null;
    if (role === 'host') {
      if (room.hostSocketId !== socketId || !safeTokenEquals(token, room.hostToken)) return null;
      return {code: room.code, role: 'host', state: this.state(room.code, true)};
    }
    if (role !== 'player') return null;
    const player = room.players.find(p => p.socketId === socketId);
    if (!player || !safeTokenEquals(token, player.token)) return null;
    return {code: room.code, role: 'player', playerId: player.id, state: this.state(room.code, false, player.id)};
  }

  // D9: the state returned to whoever made a request. Only the TV socket gets
  // TV-only cues; a phone (including the VIP) gets its own private view.
  callerState(code, socketId) {
    const room = this.find(code);
    const isTv = Boolean(socketId) && room.hostSocketId === socketId;
    const player = isTv ? null : room.players.find(p => p.socketId === socketId);
    return this.state(room.code, isTv, player ? player.id : null);
  }

  requirePlayer(code, socketId) {
    const room = this.find(code);
    const player = room.players.find(p => p.socketId === socketId);
    assert(player, 'AUTH', 'You are not seated in this room.');
    return {room, player};
  }

  requireHost(code, socketId) {
    const room = this.find(code);
    const vip = room.players.find(p => p.id === room.vipId);
    assert(room.hostSocketId === socketId || (vip && vip.socketId === socketId), 'AUTH', 'Only the VIP or TV host can use host controls.');
    return room;
  }

  setAvatar(code, socketId, avatarId) {
    const {room, player} = this.requirePlayer(code, socketId);
    assert(room.phase === 'lobby', 'PHASE', 'Avatar selection has closed.');
    assert(Number.isInteger(avatarId) && AVATAR_IDS.has(avatarId), 'AVATAR', 'Invalid avatar.');
    assert(!room.players.some(p => p !== player && p.avatarId === avatarId), 'TAKEN', 'This avatar is already taken.');
    player.avatarId = avatarId;
    player.ready = false;
    room.updatedAt = this.now();
    return this.callerState(code,socketId);
  }

  setReady(code, socketId, ready) {
    const {room, player} = this.requirePlayer(code, socketId);
    assert(room.phase === 'lobby', 'PHASE', 'You cannot ready up during a game.');
    assert(typeof ready === 'boolean', 'VALUE', 'Invalid ready status.');
    player.ready = ready;
    room.updatedAt = this.now();
    return this.callerState(code,socketId);
  }

  setSettings(code, socketId, patch) {
    const room = this.requireHost(code, socketId);
    assert(room.phase === 'lobby', 'PHASE', 'Game settings are locked while playing.');
    assert(patch && typeof patch === 'object' && !Array.isArray(patch), 'SETTINGS', 'Invalid game settings.');
    const keys = Object.keys(patch);
    assert(keys.length > 0 && keys.every(k => ['rounds', 'familyFriendly', 'timerSpeed', 'reduceMotion', 'rules', 'roundStyle', 'colourBlindSafe', 'readyCheck'].includes(k)), 'SETTINGS', 'Unknown game setting.');
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'rounds') assert(board.ROUND_OPTIONS.includes(value), 'SETTINGS', 'Choose Auto, 6, 8, 10 or 12 rounds.');
      if (key === 'timerSpeed') assert(['normal', 'relaxed'].includes(value), 'SETTINGS', 'Invalid timer speed.');
      if (key === 'roundStyle') assert(['everyone','sequential'].includes(value), 'SETTINGS', 'Choose Everyone Rolls or One at a Time.');
      if (key === 'rules') assert(['classic','showtime'].includes(value),'SETTINGS','Choose Classic or Showtime.');
      if (['familyFriendly', 'reduceMotion', 'colourBlindSafe', 'readyCheck'].includes(key)) assert(typeof value === 'boolean', 'SETTINGS', 'Invalid toggle value.');
    }
    Object.assign(room.settings, patch);
    room.updatedAt = this.now();
    return this.callerState(code,socketId);
  }

  disconnect(code, socketId) {
    const room = this.rooms.get(code);
    if (!room) return false;
    if (room.hostSocketId === socketId) {
      room.hostSocketId = null;
      if(room.phase==='board' && room.board && !Number.isFinite(room.board.pausedAt)){room.board.pausedAt=this.now();room.board.pauseKind='host';room.board.pauseReason='Waiting for the TV host to reconnect.';}
      room.updatedAt = this.now();
      return true;
    }
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return false;
    player.socketId = null;
    player.offlineSince = this.now();
    if (room.vipId === player.id) room.vipOfflineSince = this.now();
    room.updatedAt = this.now();
    return true;
  }

  leave(code, socketId) {
    const {room, player} = this.requirePlayer(code, socketId);
    assert(room.phase === 'lobby', 'PHASE', 'Players cannot leave during a game; close the tab and reconnect later.');
    room.players = room.players.filter(p => p !== player);
    if (room.vipId === player.id) {room.vipId = room.players.find(p => p.socketId)?.id || null; room.vipOfflineSince = null;}
    room.updatedAt = this.now();
    return this.callerState(code,socketId);
  }

  startGame(code,socketId) {const room=this.requireHost(code,socketId);board.start(room,this.now());room.updatedAt=this.now();matchReport.start(room,this.now());return this.callerState(code,socketId);}
  rollGame(code,socketId) {const {room,player}=this.requirePlayer(code,socketId);this.assertGame(room);board.roll(room,player.id,this.now(),this.randomInt);matchReport.observe(room,this.now());return this.callerState(code,socketId);}
  pickGameDie(code,socketId,index) {const {room,player}=this.requirePlayer(code,socketId);this.assertGame(room);board.pickDie(room,player.id,index,this.now(),this.randomInt);matchReport.observe(room,this.now());return this.callerState(code,socketId);}
  chooseGame(code,socketId,payload) {const {room,player}=this.requirePlayer(code,socketId);this.assertGame(room);board.choose(room,player.id,payload,this.now(),this.randomInt);matchReport.observe(room,this.now());return this.callerState(code,socketId);}
  answerGame(code,socketId,choice) {const {room,player}=this.requirePlayer(code,socketId);this.assertGame(room);board.answer(room,player.id,choice,this.now());matchReport.observe(room,this.now());return this.callerState(code,socketId);}
  pauseGame(code,socketId) {const room=this.requireHost(code,socketId);board.hostPause(room,this.now());room.updatedAt=this.now();matchReport.observe(room,this.now());return this.callerState(code,socketId);}
  resumeGame(code,socketId) {const room=this.requireHost(code,socketId);board.hostResume(room,this.now());room.updatedAt=this.now();matchReport.observe(room,this.now());return this.callerState(code,socketId);}
  skipDisconnectedGame(code,socketId) {const room=this.requireHost(code,socketId);board.skipDisconnected(room,this.now());room.updatedAt=this.now();matchReport.observe(room,this.now());return this.callerState(code,socketId);}
  cheerGame(code,socketId,targetId) {const {room,player}=this.requirePlayer(code,socketId);this.assertGame(room);require('./games/phase5').cheer(room,player.id,targetId);matchReport.observe(room,this.now());return this.callerState(code,socketId);}
  readyGame(code,socketId) {const {room,player}=this.requirePlayer(code,socketId);this.assertGame(room);board.readyUp(room,player.id,this.now());return this.callerState(code,socketId);}
  startNowGame(code,socketId) {const room=this.requireHost(code,socketId);this.assertGame(room);board.startNow(room,this.now());return this.callerState(code,socketId);}
  inputGame(code,socketId,value,roundKey) {const {room,player}=this.requirePlayer(code,socketId);this.assertGame(room);board.minigameInput(room,player.id,value,roundKey,this.now());matchReport.observe(room,this.now());return this.callerState(code,socketId);}
  // D10: Bid to Win answers are judged by the TV host or by any player who is NOT
  // in the duel. Neither duellist may judge (not even the VIP). First decision wins.
  adjudicateBid(code,socketId,accept) {
    const room=this.find(code);this.assertGame(room);
    if(socketId!==room.hostSocketId){
      const judge=room.players.find(p=>p.socketId===socketId);
      assert(judge,'AUTH','You are not seated in this room.');
      const duel=room.board?.showdown;
      assert(!duel || !duel.participants.includes(judge.id),'AUTH','Duellists cannot judge Bid to Win answers. The TV or another player will judge.');
    }
    require('./games/phase5').decideBid(room,accept,this.now(),board.finishTurn);
    matchReport.observe(room,this.now());
    return this.callerState(code,socketId);
  }
  drawGame(code,socketId,points,roundKey) {const {room,player}=this.requirePlayer(code,socketId);this.assertGame(room);board.minigameDraw(room,player.id,points,roundKey,this.now());matchReport.observe(room,this.now());return this.callerState(code,socketId);}
  assertGame(room) {assert(room.phase === 'board' && room.hostSocketId, 'PHASE', 'The NOGGIN board is not running.');assert(!Number.isFinite(room.board.pausedAt),'PAUSED','The game is paused for reconnection.');}
  getMatchReport(code,socketId) {const room=this.requireHost(code,socketId);assert(room.matchReport,'PHASE','Start a game before exporting a report.');return matchReport.report(room,this.now());}
  close(code, socketId) {
    this.requireHost(code, socketId);
    this.rooms.delete(code);
  }

  sweep() {
    const changed = [];
    for (const room of this.rooms.values()) {
      if (room.vipOfflineSince !== null && room.vipOfflineSince !== undefined && this.now() - room.vipOfflineSince >= 30_000) {
        const candidate = room.players.filter(p => p.socketId && p.id !== room.vipId).sort((a,b) => ((a.seat - (room.players.find(v => v.id === room.vipId)?.seat || 0) + MAX_PLAYERS) % MAX_PLAYERS) - ((b.seat - (room.players.find(v => v.id === room.vipId)?.seat || 0) + MAX_PLAYERS) % MAX_PLAYERS))[0];
        if (candidate) {room.vipId = candidate.id; room.vipOfflineSince = null; changed.push(room.code);}
      }
      const oldLength = room.players.length;
      if (room.phase === 'lobby') room.players = room.players.filter(p => p.socketId || p.offlineSince === null || this.now() - p.offlineSince <= LOBBY_GRACE_MS);
      if (!room.players.some(p => p.id === room.vipId)) {room.vipId = room.players.find(p => p.socketId)?.id || null; room.vipOfflineSince = null;}
      if (room.players.length !== oldLength) changed.push(room.code);
      if (board.tick(room,this.now(),this.randomInt)) changed.push(room.code);
      matchReport.observe(room,this.now());
      if (!room.hostSocketId && this.now() - room.updatedAt > EMPTY_ROOM_TTL_MS) {
        this.rooms.delete(room.code);
        changed.push(room.code);
      }
    }
    return changed;
  }
}

module.exports = {GameRooms, LobbyError, normalizeName, normalizeCode, safeTokenEquals, SEAT_GRACE_MS, LOBBY_GRACE_MS, MAX_PLAYERS};
