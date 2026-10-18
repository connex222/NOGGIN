'use strict';
const os = require('node:os');

function allLanAddresses(interfaces = os.networkInterfaces()) {
  const choices = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const addr of addresses || []) {
      if ((addr.family !== 'IPv4' && addr.family !== 4) || addr.internal) continue;
      const ip = addr.address;
      if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) continue;
      const bonus = /ethernet|wi.?fi|wlan|en\d|eth\d/i.test(name) ? 10 : 0;
      const penalty = /virtual|docker|veth|vmware|vbox|tailscale|tun|vpn|wsl|hyper-v/i.test(name) ? -20 : 0;
      const precedence = ip.startsWith('192.168.') ? 3 : ip.startsWith('10.') ? 2 : 1;
      choices.push({name, ip, rank: bonus + penalty + precedence});
    }
  }
  return choices.sort((a,b) => b.rank - a.rank).map(x=>x.ip);
}

function joinBaseUrl(req, {publicUrl = process.env.NOGGIN_PUBLIC_URL || '', lanAddresses = allLanAddresses()} = {}) {
  if (publicUrl) {
    const u = new URL(publicUrl);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('NOGGIN_PUBLIC_URL must be HTTP(S).');
    return u.origin;
  }
  const behindProxy = Boolean(process.env.RENDER || process.env.TRUST_PROXY === '1');
  const forwardedHost = behindProxy ? String(req.headers['x-forwarded-host'] || '').split(',')[0].trim() : '';
  const host = forwardedHost || String(req.headers.host || '').trim();
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  const port = Number(process.env.PORT) || 3000;
  if (isLocalhost && lanAddresses.length) return `http://${lanAddresses[0]}:${port}`;
  const validHost = /^[a-zA-Z0-9.\-\[\]:]+(?::\d+)?$/.test(host) && host.length <= 255;
  if (!validHost) return `http://${lanAddresses[0] || 'localhost'}:${port}`;
  const forwardedProto = behindProxy ? String(req.headers['x-forwarded-proto'] || '').split(',')[0] : '';
  const proto = forwardedProto === 'https' || req.secure ? 'https' : 'http';
  return `${proto}://${host}`;
}
function joinUrl(req, code, options) { return `${joinBaseUrl(req, options)}/play/?room=${encodeURIComponent(code)}`; }
module.exports = {allLanAddresses, joinBaseUrl, joinUrl};
