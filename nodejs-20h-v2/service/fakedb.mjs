// Fake DB (TCP, line protocol "id query\n" -> "id json\n") + control/stream HTTP server.
// DB_PORT (7001): queries. CTL_PORT (7002): /mode?delay=ms&down=0|1, /stats, /stream?rows=&hang=1&every=
import net from 'node:net';
import http from 'node:http';

const DB_PORT = +process.env.DB_PORT || 7001;
const CTL_PORT = +process.env.CTL_PORT || 7002;
let delay = +process.env.DB_DELAY || 5;
let down = false;
let activeStreams = 0, streamsTotal = 0;
const sockets = new Set();
let srv;

function startDb() {
  srv = net.createServer((s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
    s.on('error', () => {});
    let buf = '';
    s.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        const sp = line.indexOf(' ');
        const id = line.slice(0, sp), q = line.slice(sp + 1);
        setTimeout(() => {
          if (!s.destroyed) s.write(id + ' ' + JSON.stringify({ row: { q, name: 'user-' + q, at: Date.now() } }) + '\n');
        }, delay);
      }
    });
  });
  srv.listen(DB_PORT, '127.0.0.1');
}
startDb();

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/mode') {
    if (u.searchParams.has('delay')) delay = +u.searchParams.get('delay');
    if (u.searchParams.get('down') === '1' && !down) { down = true; srv.close(); for (const s of sockets) s.destroy(); }
    if (u.searchParams.get('down') === '0' && down) { down = false; startDb(); }
    return res.end(JSON.stringify({ delay, down }));
  }
  if (u.pathname === '/stats') return res.end(JSON.stringify({ activeStreams, streamsTotal }));
  if (u.pathname === '/stream') {
    const rows = +u.searchParams.get('rows') || 1000;
    const hang = u.searchParams.get('hang') === '1';
    const every = +u.searchParams.get('every') || 0;
    activeStreams++; streamsTotal++;
    let done = false;
    res.on('close', () => { if (!done) { done = true; activeStreams--; } });
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    let i = 0;
    const tick = () => {
      if (res.destroyed) return;
      while (i < rows) {
        const ok = res.write(JSON.stringify({ i, pad: 'x'.repeat(100) }) + '\n');
        i++;
        if (every && i % every === 0) return setTimeout(tick, 10);
        if (!ok) return res.once('drain', tick);
      }
      if (!hang) res.end();
    };
    tick();
    return;
  }
  res.statusCode = 404; res.end();
}).listen(CTL_PORT, '127.0.0.1', () => console.log('fakedb ready', DB_PORT, CTL_PORT));
