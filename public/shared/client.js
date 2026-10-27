'use strict';
// Small client helpers shared by the TV and phone. The Socket.IO client is served locally.
window.Noggin = Object.freeze({
  // D13: private browsing or a full/blocked storage must never stop joining.
  // Every localStorage read and write is wrapped; failures just mean "not saved".
  storageGet(key) {try {return localStorage.getItem(key);} catch {return null;}},
  storageSet(key, value) {try {localStorage.setItem(key, String(value)); return true;} catch {return false;}},
  storageRemove(key) {try {localStorage.removeItem(key);} catch {}},
  readSession(key) {
    try {return JSON.parse(localStorage.getItem(key) || 'null');} catch {return null;}
  },
  saveSession(key, value) {try {localStorage.setItem(key, JSON.stringify(value)); return true;} catch {return false;}},
  clearSession(key) {try {localStorage.removeItem(key);} catch {}},
  request(socket, event, data = {}) {
    return new Promise((resolve,reject) => {
      socket.timeout(7000).emit(event, data, (err, result) => {
        // Errors carry the server's code (e.g. AUTH, ROOM) so callers can tell
        // "seat gone" apart from a temporary network problem.
        const fail = (code, message) => {const e = new Error(message); e.code = code; return e;};
        if (err) return reject(fail('TIMEOUT', 'Connection timed out. Check your Wi-Fi and retry.'));
        if (!result?.ok) return reject(fail(result?.code || 'SERVER', result?.message || 'Request failed.'));
        resolve(result);
      });
    });
  },
  el(id) { return document.getElementById(id); },
  image(avatar, state = 'think') { return avatar?.images?.[state] || ''; },
  initials(name) {return (name || '?').trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase() || '').join('');}
});
