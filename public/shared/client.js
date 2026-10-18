'use strict';
// Small client helpers shared by the TV and phone. The Socket.IO client is served locally.
window.Noggin = Object.freeze({
  readSession(key) {
    try {return JSON.parse(localStorage.getItem(key) || 'null');} catch {return null;}
  },
  saveSession(key, value) {localStorage.setItem(key, JSON.stringify(value));},
  clearSession(key) {localStorage.removeItem(key);},
  request(socket, event, data = {}) {
    return new Promise((resolve,reject) => {
      socket.timeout(7000).emit(event, data, (err, result) => {
        if (err) return reject(new Error('Connection timed out. Check your Wi-Fi and retry.'));
        if (!result?.ok) return reject(new Error(result?.message || 'Request failed.'));
        resolve(result);
      });
    });
  },
  el(id) { return document.getElementById(id); },
  image(avatar, state = 'think') { return avatar?.images?.[state] || ''; },
  initials(name) {return (name || '?').trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase() || '').join('');}
});
