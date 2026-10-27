// Global fetch (bundled undici) against misbehaving servers.
// Predict each line before running:
//  1. server never sends headers; fetch with AbortSignal.timeout(500): error name + time
//  2. server sends headers then stalls body; same signal: does `await fetch()` resolve? does body read fail, when?
//  3. same as 2 with dispatcher Agent({ bodyTimeout: 500 }): error code + time
//  4. 200 concurrent fetches to one origin with the default global dispatcher: how many TCP connections?
//  5. default headersTimeout/bodyTimeout of the bundled client (read from source, printed for reference)
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(process.env.UNDICI_DIR ? process.env.UNDICI_DIR + '/' : import.meta.url);
const { Agent } = require('undici');

let conns = 0;
const server = http.createServer((req, res) => {
  if (req.url === '/no-headers') return; // never respond
  if (req.url === '/stall-body') { res.writeHead(200); res.write('partial'); return; }
  if (req.url === '/slow') return setTimeout(() => res.end('ok'), 300);
  res.end('ok');
});
server.on('connection', () => conns++);
server.keepAliveTimeout = 60_000;
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const t = () => { const s = performance.now(); return () => Math.round(performance.now() - s) + 'ms'; };

{ const el = t(); try { await fetch(base + '/no-headers', { signal: AbortSignal.timeout(500) }); } catch (e) { console.log(`1. ${e.name} after ${el()}`); } }
{ const el = t(); const r = await fetch(base + '/stall-body', { signal: AbortSignal.timeout(500) });
  const head = el();
  try { await r.text(); } catch (e) { console.log(`2. fetch resolved after ${head}; body read: ${e.name} after ${el()}`); } }
{ const el = t(); const r = await fetch(base + '/stall-body', { dispatcher: new Agent({ bodyTimeout: 500 }) });
  try { await r.text(); } catch (e) { console.log(`3. body read: ${e.cause?.code || e.code || e.name} after ${el()}`); } }
{ conns = 0; const el = t(); await Promise.all(Array.from({ length: 200 }, () => fetch(base + '/slow').then((r) => r.text())));
  console.log(`4. 200 concurrent fetches -> ${conns} TCP connections, ${el()}`); }
{ conns = 0; const d = new Agent({ connections: 10 }); const el = t(); await Promise.all(Array.from({ length: 200 }, () => fetch(base + '/slow', { dispatcher: d }).then((r) => r.text())));
  console.log(`4b. same with Agent({connections:10}) -> ${conns} TCP connections, ${el()}`); }
console.log(`node ${process.version}, bundled undici ${process.versions.undici}`);
server.closeAllConnections(); server.close();
