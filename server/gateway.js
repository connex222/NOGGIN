'use strict';
const {GameRooms, LobbyError, normalizeCode, safeTokenEquals} = require('./rooms');
const {AttemptLimiter} = require('./limiter');
const {joinUrl} = require('./network');
const {isIP} = require('node:net');

function attachGateway(io, {rooms = new GameRooms(), limiter = new AttemptLimiter(), QRCode} = {}) {
  if (!QRCode) throw new Error('Pass a QR generator to attachGateway.');
  const bindings = new Map();
  const roomSockets = new Map();
  const MAX_PAYLOAD = 512;
  // Respect a verified reverse proxy (e.g. Render), otherwise use the direct socket IP.
  function clientIp(socket) {
    const directIp = socket.handshake.address || socket.request.socket?.remoteAddress || 'unknown';
    if (!process.env.RENDER && process.env.TRUST_PROXY !== '1') return directIp;
    const forwarded = socket.handshake.headers?.['x-forwarded-for'] || socket.request.headers?.['x-forwarded-for'];
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
    return isIP(first) ? first : directIp;
  }

  function broadcast(code) {
    if (!rooms.rooms.has(code)) return;
    for (const socketId of roomSockets.get(code) || []) {
      const bound = bindings.get(socketId);
      if (!bound) continue;
      io.to(socketId).emit('room:state', rooms.state(code, bound.role === 'host',
        bound.role === 'player' ? bound.playerId : null));
    }
  }
  function unbind(socketId) {
    const old = bindings.get(socketId);
    if (!old) return;
    bindings.delete(socketId);
    const ids = roomSockets.get(old.code);
    if (ids) {
      ids.delete(socketId);
      if (!ids.size) roomSockets.delete(old.code);
    }
  }
  function leaveBinding(socket) {
    const old = bindings.get(socket.id);
    if (!old) return;
    rooms.disconnect(old.code, socket.id);
    socket.leave(old.code);
    unbind(socket.id);
    broadcast(old.code);
  }
  function bind(socket, code, role, playerId = null) {
    const old = bindings.get(socket.id);
    if (old && old.code !== code) leaveBinding(socket);
    bindings.set(socket.id, {code, role, playerId});
    if (!roomSockets.has(code)) roomSockets.set(code, new Set());
    roomSockets.get(code).add(socket.id);
    socket.join(code);
  }
  function getBound(socket, role) {
    const bound = bindings.get(socket.id);
    if (!bound || (role && bound.role !== role)) throw new LobbyError('AUTH', 'Not connected to the correct room.');
    return bound.code;
  }
  const wrap = (fn,maxPayload=512) => async (payload, callback) => {
    if (typeof callback !== 'function') return;
    try {
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload) || Buffer.byteLength(JSON.stringify(payload), 'utf8') > maxPayload) {
        throw new LobbyError('INPUT', 'Invalid request.');
      }
      const response = await fn(payload);
      callback({ok: true, ...response});
    } catch (error) {
      callback({ok: false, code: (error.code && typeof error.code==='string') ? error.code : 'SERVER', message: (error.code && typeof error.code==='string') ? error.message : 'The server could not process that. Please retry.'});
    }
  };

  io.on('connection', socket => {
    socket.on('room:create', wrap(async () => {
      if (bindings.has(socket.id)) throw new LobbyError('AUTH', 'You already have a room.');
      if (!limiter.allow(`${clientIp(socket)}:create`, 4)) throw new LobbyError('RATE', 'Too many new rooms. Wait one minute.');
      // QR generation is transactional: no orphan room on a failed encoder.
      const result = rooms.create(socket.id);
      try {
        const link = joinUrl(socket.request, result.code);
        const qrDataUrl = await QRCode.toDataURL(link, {margin: 2, errorCorrectionLevel: 'M', width: 256, color: {dark: '#13213C', light: '#FFFFFFFF'}});
        bind(socket, result.code, 'host');
        broadcast(result.code);
        return {...result, joinUrl: link, qrDataUrl};
      }catch(error){rooms.rooms.delete(result.code);throw error;}
    }));

    socket.on('room:peek', wrap(async ({code}) => {
      const ip = clientIp(socket);
      if (!limiter.allow(`${ip}:peek`, 12)) throw new LobbyError('RATE', 'Too many room lookups. Wait one minute.');
      const roomCode = normalizeCode(code);
      if (rooms.find(roomCode).phase !== 'lobby') throw new LobbyError('PHASE', 'That show has already started. Ask the host for a new room.');
      return {state: rooms.state(roomCode)};
    }));

    socket.on('room:join', wrap(async ({code, name, avatarId}) => {
      const ip = clientIp(socket);
      if (!limiter.allow(`${ip}:join`, 32)) throw new LobbyError('RATE', 'Too many join attempts. Wait one minute and try again.');
      if (bindings.has(socket.id)) throw new LobbyError('AUTH', 'Leave your current room first.');
      const result = rooms.join({code, name, avatarId, socketId: socket.id});
      bind(socket, result.code, 'player',result.playerId);
      broadcast(result.code);
      return result;
    }));

    socket.on('room:resume', wrap(async ({code, token, role}) => {
      if (bindings.has(socket.id)) throw new LobbyError('AUTH','Leave your current session before resuming another.');
      // Validate the host token and generate the QR BEFORE taking the session
      // over. A QR encoder failure must not strand the original host socket.
      let extra = {};
      if (role === 'host') {
        const previous=rooms.find(code);
        if (!safeTokenEquals(token,previous.hostToken)) throw new LobbyError('AUTH','Your host session is no longer available.');
        const link=joinUrl(socket.request,previous.code);
        const qrDataUrl=await QRCode.toDataURL(link,{margin:2,errorCorrectionLevel:'M',width:256,color:{dark:'#13213C',light:'#FFFFFFFF'}});
        extra={joinUrl:link,qrDataUrl};
      }
      const result = rooms.resume({code, token, role, socketId: socket.id});
      if (result.oldSocketId && result.oldSocketId !== socket.id) {
        const older = io.sockets.sockets.get(result.oldSocketId);
        if (older) { older.emit('room:session-replaced'); older.leave(result.code); }
        unbind(result.oldSocketId);
      }
      bind(socket, result.code, result.role,result.playerId||null);
      broadcast(result.code);
      return {...result, ...extra};
    }));

    socket.on('room:avatar', wrap(async ({avatarId}) => {
      const code = getBound(socket, 'player');
      const state = rooms.setAvatar(code, socket.id, avatarId);
      broadcast(code); return {state};
    }));

    socket.on('room:ready', wrap(async ({ready}) => {
      const code = getBound(socket, 'player');
      const state = rooms.setReady(code, socket.id, ready);
      broadcast(code); return {state};
    }));

    socket.on('room:settings', wrap(async ({patch}) => {
      const code = getBound(socket);
      const state = rooms.setSettings(code, socket.id, patch);
      broadcast(code); return {state};
    }));

    socket.on('game:report', wrap(async () => {const code=getBound(socket);return {report:rooms.getMatchReport(code,socket.id)};}));
    socket.on('game:pause', wrap(async () => {const code=getBound(socket);const state=rooms.pauseGame(code,socket.id);broadcast(code);return {state};}));
    socket.on('game:resume', wrap(async () => {const code=getBound(socket);const state=rooms.resumeGame(code,socket.id);broadcast(code);return {state};}));
    socket.on('game:skip-offline', wrap(async () => {const code=getBound(socket);const state=rooms.skipDisconnectedGame(code,socket.id);broadcast(code);return {state};}));
    socket.on('game:start', wrap(async () => {const code=getBound(socket);const state=rooms.startGame(code,socket.id);broadcast(code);return {state};}));
    socket.on('game:roll', wrap(async () => {const code=getBound(socket,'player');const state=rooms.rollGame(code,socket.id);broadcast(code);return {state};}));
    socket.on('game:pick-die', wrap(async ({index}) => {const code=getBound(socket,'player');const state=rooms.pickGameDie(code,socket.id,index);broadcast(code);return {state};}));
    socket.on('game:choose', wrap(async ({targetId,category,action,option}) => {const code=getBound(socket,'player');const state=rooms.chooseGame(code,socket.id,{targetId,category,action,option});broadcast(code);return {state};}));
    socket.on('game:answer', wrap(async ({choice}) => {const code=getBound(socket,'player');const state=rooms.answerGame(code,socket.id,choice);broadcast(code);return {state};}));
    socket.on('game:cheer', wrap(async ({targetId}) => {const code=getBound(socket,'player');const state=rooms.cheerGame(code,socket.id,targetId);broadcast(code);return {state};}));
    socket.on('game:bid-review', wrap(async ({accept}) => {const code=getBound(socket);const state=rooms.adjudicateBid(code,socket.id,accept);broadcast(code);return {state};}));
    socket.on('game:input', wrap(async ({value,roundKey}) => {const code=getBound(socket,'player');const state=rooms.inputGame(code,socket.id,value,roundKey);broadcast(code);return {state};}));
    socket.on('game:draw', wrap(async ({points,roundKey}) => {
      const code = getBound(socket, 'player');
      // rooms.drawGame validates the session, round, role, deadline and points.
      const state = rooms.drawGame(code, socket.id, points, roundKey);
      const mini = state.board?.minigame;
      const strokeCount = mini?.display?.strokes?.length;
      // Only TV hosts require live drawing updates. A new/reconnecting TV
      // receives all previous strokes from its ordinary state snapshot.
      if (mini?.id === 'sketch-sabotage' && mini.phase === 'play' && strokeCount) {
        for (const socketId of roomSockets.get(code) || []) {
          if (bindings.get(socketId)?.role === 'host') {
            io.to(socketId).emit('game:stroke', {code, roundKey, index: strokeCount - 1, points});
          }
        }
      }
      return {state};
    }, 4096));

    socket.on('room:leave', wrap(async () => {
      const code = getBound(socket, 'player');
      rooms.leave(code, socket.id);
      unbind(socket.id);
      socket.leave(code);
      broadcast(code);
      return {};
    }));

    socket.on('room:close', wrap(async () => {
      const code = getBound(socket);
      rooms.close(code, socket.id);
      io.to(code).emit('room:closed');
      for (const id of [...(roomSockets.get(code) || [])]) unbind(id);
      io.in(code).socketsLeave(code);
      return {};
    }));

    socket.on('disconnect', () => leaveBinding(socket));
  });

  const interval = setInterval(() => {
    const changed = rooms.sweep();
    for (const code of changed) if (rooms.rooms.has(code)) broadcast(code); else io.to(code).emit('room:closed');
    limiter.sweep();
  }, 250);
  interval.unref?.();
  return {rooms, limiter, stop: () => clearInterval(interval)};
}
module.exports = {attachGateway};
