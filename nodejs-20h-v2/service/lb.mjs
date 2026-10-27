// Mini L7 load balancer that behaves like a cloud LB on the backend side:
//  - keeps a pool of keep-alive connections per backend, reuses any open one younger than IDLE_MS
//  - ignores the backend's "Keep-Alive: timeout=" hint (ALB-style)
//  - honors "Connection: close" in backend responses
//  - returns 502 if the backend connection dies before a full response; no retries
//  - health check GET /health every HC_MS; 503 or refused => out of rotation
// Supports Content-Length responses only (enough for /user, /health).
import http from 'node:http';
import net from 'node:net';

const PORT = +process.env.LB_PORT || 9000;
const STATS_PORT = +process.env.LB_STATS_PORT || 9001;
const IDLE_MS = +process.env.LB_IDLE_MS || 60_000;
const HC_MS = +process.env.HC_MS || 200;
const backends = (process.env.BACKENDS || '127.0.0.1:8080').split(',').map((s) => {
  const [host, port] = s.split(':');
  return { host, port: +port, healthy: true, idle: [], sent: 0, s502: 0 };
});
const stats = { requests: 0, s502: 0, s503: 0, reused: 0, fresh: 0, reasons: {} };
let rr = 0;

function pick() {
  for (let i = 0; i < backends.length; i++) {
    const b = backends[rr++ % backends.length];
    if (b.healthy) return b;
  }
  return null;
}

function getConn(b) {
  while (b.idle.length) {
    const c = b.idle.shift(); // oldest idle first
    if (!c.sock.destroyed && c.sock.readyState === 'open' && Date.now() - c.at < IDLE_MS) { stats.reused++; return c.sock; }
    c.sock.destroy();
  }
  stats.fresh++;
  const sock = net.connect(b.port, b.host);
  sock.setNoDelay(true);
  sock.on('error', () => {});
  return sock;
}

function release(b, sock) {
  const entry = { sock, at: Date.now() };
  const drop = () => { const i = b.idle.indexOf(entry); if (i >= 0) b.idle.splice(i, 1); };
  sock.once('end', drop);
  sock.once('close', drop);
  b.idle.push(entry);
}

function forward(b, req, body, res) {
  const sock = getConn(b);
  sock.removeAllListeners('end');
  sock.removeAllListeners('close');
  sock.removeAllListeners('data');
  sock.removeAllListeners('error');
  sock.on('error', () => {});
  let buf = Buffer.alloc(0), headEnd = -1, status = 0, len = 0, headers = {}, done = false;
  const fail = (why) => {
    if (done) return;
    done = true;
    stats.s502++; b.s502++;
    stats.reasons[why] = (stats.reasons[why] || 0) + 1;
    sock.destroy();
    if (!res.headersSent) { res.writeHead(502); res.end('bad gateway'); }
  };
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    if (headEnd < 0) {
      headEnd = buf.indexOf('\r\n\r\n');
      if (headEnd < 0) return;
      const lines = buf.subarray(0, headEnd).toString().split('\r\n');
      status = +lines[0].split(' ')[1];
      for (const l of lines.slice(1)) { const i = l.indexOf(':'); headers[l.slice(0, i).toLowerCase()] = l.slice(i + 1).trim(); }
      len = +(headers['content-length'] || 0);
    }
    if (buf.length - headEnd - 4 >= len) {
      done = true;
      const bodyOut = buf.subarray(headEnd + 4, headEnd + 4 + len);
      sock.removeAllListeners('data');
      sock.removeAllListeners('end');
      sock.removeAllListeners('close');
      if ((headers.connection || '').toLowerCase() === 'close') sock.end(); else release(b, sock);
      res.writeHead(status, { 'content-type': headers['content-type'] || 'text/plain' });
      res.end(bodyOut);
    }
  });
  sock.once('end', () => fail('backend closed before response (FIN)'));
  sock.once('close', () => fail('backend connection closed'));
  sock.on('error', (e) => fail(e.code || 'error'));
  b.sent++;
  sock.write(`${req.method} ${req.url} HTTP/1.1\r\nhost: backend\r\ncontent-length: ${body.length}\r\n\r\n`);
  if (body.length) sock.write(body);
}

http.createServer(async (req, res) => {
  stats.requests++;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const b = pick();
  if (!b) { stats.s503++; res.writeHead(503); return res.end('no healthy backend'); }
  forward(b, req, Buffer.concat(chunks), res);
}).listen(PORT, '127.0.0.1', () => console.log(`lb on ${PORT} -> ${backends.map((b) => b.port).join(',')} idle=${IDLE_MS}ms`));

http.createServer((req, res) => {
  if (req.url.startsWith('/reset')) { Object.assign(stats, { requests: 0, s502: 0, s503: 0, reused: 0, fresh: 0, reasons: {} }); for (const b of backends) { b.sent = 0; b.s502 = 0; } }
  res.end(JSON.stringify({ ...stats, backends: backends.map(({ host, port, healthy, sent, s502, idle }) => ({ host, port, healthy, sent, s502, idle: idle.length })) }));
}).listen(STATS_PORT, '127.0.0.1');

setInterval(() => {
  for (const b of backends) {
    const r = http.get({ host: b.host, port: b.port, path: '/health', agent: false, timeout: 500 }, (res) => {
      b.healthy = res.statusCode === 200;
      res.resume();
    });
    r.on('error', () => { b.healthy = false; });
    r.on('timeout', () => { r.destroy(); });
  }
}, HC_MS);
