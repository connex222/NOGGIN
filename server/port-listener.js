'use strict';

// Listen on the requested port, optionally trying nearby ports for local Windows play.
// Never automatically move a public deployment to a different port: its platform
// supplies a required PORT value and proxies traffic to that exact port.
function listenWithFallback(server, {
  port = Number(process.env.PORT) || 3000,
  host = '0.0.0.0',
  autoFallback = false,
  maxExtraPorts = 10,
  onListening = () => {},
  onRetry = () => {},
  onFailure = () => {},
} = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a whole number between 1 and 65535.');
  }
  let selectedPort = port;
  const lastPort = Math.min(65535, port + maxExtraPorts);
  let connected = false;

  server.on('error', error => {
    if (!connected && autoFallback && error.code === 'EADDRINUSE' && selectedPort < lastPort) {
      const oldPort = selectedPort;
      selectedPort += 1;
      process.env.PORT = String(selectedPort); // QR links use this value too.
      onRetry(oldPort, selectedPort);
      server.listen(selectedPort, host);
      return;
    }
    onFailure(error, selectedPort);
  });
  server.on('listening', () => {
    connected = true;
    onListening(selectedPort);
  });
  process.env.PORT = String(selectedPort);
  server.listen(selectedPort, host);
}

module.exports = {listenWithFallback};
