'use strict';
(async () => {
  const paths = [
    ['/health', 'NOGGIN server'],
    ['/tv/', 'TV page'],
    ['/tv/tv.js', 'TV script'],
    ['/tv/board-view.js', 'Board script'],
    ['/tv/sound.js', 'Sound script'],
    ['/shared/client.js', 'Shared script'],
    ['/shared/theme.css', 'Style sheet'],
    ['/socket.io/socket.io.js', 'Multiplayer client'],
  ];
  const list = document.getElementById('checks');
  let problems = 0;
  for (const [url, label] of paths) {
    const item = document.createElement('li');
    try {
      const response = await fetch(url, {cache:'no-store',signal:AbortSignal.timeout(5000)});
      let ok = response.ok;
      if (url === '/health' && ok) {
        const result = await response.json();
        ok = result.game === 'NOGGIN' && result.ok === true;
      }
      item.textContent = (ok ? 'PASS' : 'FAIL') + ' — ' + label + ' (' + url + ')' + (ok ? '' : ' — HTTP ' + response.status);
      if (!ok) problems++;
    } catch (error) {
      item.textContent = 'FAIL — ' + label + ' (' + url + '): ' + error.message;
      problems++;
    }
    item.className = item.textContent.startsWith('PASS') ? 'pass' : 'fail';
    list.append(item);
  }
  document.getElementById('report').textContent = problems === 0
    ? 'All eight checks passed. If the TV still has a problem, refresh /tv/ with Ctrl+F5.'
    : problems + ' check(s) failed. Make sure you used the address printed in the NOGGIN server window.';
})();
