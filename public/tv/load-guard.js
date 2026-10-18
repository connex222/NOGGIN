'use strict';
(() => {
  const diagnosis = '/check/';
  let reported = false;
  function fail(reason) {
    if (reported) return;
    reported = true;
    const el = document.getElementById('startupProblem');
    if (!el) return;
    el.hidden = false;
    el.textContent = 'NOGGIN could not finish loading: ' + reason + '. Open ' + diagnosis + ' on this same port to check the game files.';
  }
  window.addEventListener('error', event => {
    if (event.target?.tagName === 'SCRIPT') {
      fail('a required JavaScript file did not load (' + new URL(event.target.src).pathname + ')');
    } else if (event.error) {
      fail(event.error.message || 'a JavaScript error occurred');
    }
  }, true);
  window.addEventListener('unhandledrejection', event => {
    fail(event.reason?.message || 'an asynchronous JavaScript error occurred');
  });
  // An unreachable Socket.IO server will otherwise leave the lobby stuck at CONNECTING.
  setTimeout(() => {
    if (document.getElementById('connectionLabel')?.textContent === 'CONNECTING') {
      fail('the game server has not connected after 12 seconds');
    }
  }, 12000);
  window.NogginLaunchGuard = {fail};
})();
