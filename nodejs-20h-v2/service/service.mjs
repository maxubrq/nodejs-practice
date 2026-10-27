// Sample service. MODE=naive|fixed. Same routes, two implementations.
//   GET  /user/:id         -> DB query
//   POST /ingest           -> JSON body
//   GET  /validate?name=   -> regex validation
//   GET  /export?rows=&hang=1 -> proxy an upstream NDJSON stream
//   GET  /health, /metrics[?reset]
import http from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { createDb } from './db-client.mjs';

const MODE = process.env.MODE || 'naive';
const FIXED = MODE === 'fixed';
const PORT = +process.env.PORT || 8080;
const UPSTREAM = process.env.UPSTREAM || 'http://127.0.0.1:7002';
const DB_TIMEOUT_MS = 300;
const BODY_LIMIT = 1 << 20;          // 1 MiB
const UPSTREAM_IDLE_MS = 2000;
const DRAIN_DELAY_MS = +process.env.DRAIN_DELAY_MS || 1000;

const db = createDb({ port: +process.env.DB_PORT || 7001, queueWhileDown: !FIXED });

// --- metrics: RSS max, timer-drift lag max, ELD histogram (resolution bias documented in PLAN) ---
const eld = monitorEventLoopDelay({ resolution: 10 });
eld.enable();
let maxRss = process.memoryUsage.rss(), maxLag = 0, last = performance.now();
setInterval(() => {
  const now = performance.now();
  maxLag = Math.max(maxLag, now - last - 20);
  last = now;
  maxRss = Math.max(maxRss, process.memoryUsage.rss());
}, 20).unref();

let inflight = 0, draining = false;

const server = http.createServer(async (req, res) => {
  inflight++;
  res.on('close', () => inflight--);
  if (draining) res.setHeader('connection', 'close');
  try {
    await route(req, res);
  } catch (e) {
    if (!res.headersSent && !res.destroyed) {
      res.statusCode = e.status || 500;
      res.end(JSON.stringify({ error: e.code || e.name || 'error' }));
    } else if (!res.destroyed) {
      res.destroy(e);
    }
  }
});
if (process.env.KEEPALIVE_MS) server.keepAliveTimeout = +process.env.KEEPALIVE_MS;
// BUSY_MS: simulate a CPU-busy backend (sync work of BUSY_MS every 25 ms) -> event loop lag.
if (process.env.BUSY_MS) setInterval(() => { const end = performance.now() + +process.env.BUSY_MS; while (performance.now() < end); }, 25).unref();
server.listen(PORT, '127.0.0.1', () => console.log(`service ${MODE} on ${PORT} pid ${process.pid}`));

// res 'close' fires both on normal completion and on client disconnect;
// writableFinished=false at that moment is what distinguishes "client gone" (see b-exp/e1-req-close.mjs).
function clientGone(res) {
  const ac = new AbortController();
  res.once('close', () => { if (!res.writableFinished) ac.abort(Object.assign(new Error('client gone'), { name: 'ClientGone' })); });
  return ac.signal;
}

async function route(req, res) {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') {
    res.statusCode = draining ? 503 : 200;
    return res.end(draining ? 'draining' : 'ok');
  }
  if (u.pathname === '/metrics') {
    const out = {
      mode: MODE, rss: process.memoryUsage.rss(), maxRss, maxLagMs: +maxLag.toFixed(1),
      eldMaxMs: +(eld.max / 1e6).toFixed(1), inflight, dbPending: db.pendingCount, dbQueued: db.queued,
      activeResources: process.getActiveResourcesInfo().length,
    };
    if (u.searchParams.has('reset')) { eld.reset(); maxRss = process.memoryUsage.rss(); maxLag = 0; }
    return res.end(JSON.stringify(out));
  }
  if (u.pathname.startsWith('/user/')) return user(req, res, u.pathname.slice(6));
  if (u.pathname === '/ingest' && req.method === 'POST') return ingest(req, res);
  if (u.pathname === '/validate') return validate(res, u.searchParams.get('name') ?? '');
  if (u.pathname === '/export') return exportRows(req, res, u);
  res.statusCode = 404;
  res.end();
}

async function user(req, res, id) {
  if (!FIXED) {
    const r = await db.query('user:' + id);
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(r.row));
  }
  const signal = AbortSignal.any([clientGone(res), AbortSignal.timeout(DB_TIMEOUT_MS)]);
  try {
    const r = await db.query('user:' + id, { signal });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(r.row));
  } catch (e) {
    e.status = e.name === 'TimeoutError' ? 504 : 503;
    throw e;
  }
}

function reject413(req, res) {
  res.writeHead(413, { connection: 'close' });
  res.end('payload too large');
  res.once('finish', () => req.socket.destroySoon?.() ?? req.socket.end());
}

async function ingest(req, res) {
  if (!FIXED) {
    let body = '';
    for await (const c of req) body += c;
    const obj = JSON.parse(body);
    return res.end(JSON.stringify({ ok: true, items: obj.items?.length }));
  }
  if (+req.headers['content-length'] > BODY_LIMIT) return reject413(req, res);
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > BODY_LIMIT) return reject413(req, res);
    chunks.push(c);
  }
  const obj = JSON.parse(Buffer.concat(chunks));
  res.end(JSON.stringify({ ok: true, items: obj.items?.length }));
}

const NAIVE_RE = /^([a-zA-Z0-9]+\s?)+$/;          // nested quantifier: exponential backtracking
const FIXED_RE = /^[a-zA-Z0-9]+(?:\s[a-zA-Z0-9]+)*\s?$/; // unambiguous: linear
function validate(res, name) {
  const ok = FIXED ? (name.length <= 64 && FIXED_RE.test(name)) : NAIVE_RE.test(name);
  res.statusCode = ok ? 200 : 400;
  res.end(ok ? 'valid' : 'invalid');
}

function idleTimeout(ms) {
  let t;
  const tr = new Transform({
    transform(chunk, _enc, cb) { t.refresh(); cb(null, chunk); },
    flush(cb) { clearTimeout(t); cb(); },
    destroy(err, cb) { clearTimeout(t); cb(err); },
  });
  t = setTimeout(() => tr.destroy(Object.assign(new Error('upstream idle'), { code: 'EUPSTREAMIDLE' })), ms);
  return tr;
}

async function exportRows(req, res, u) {
  const url = `${UPSTREAM}/stream?rows=${u.searchParams.get('rows') || 1000}` +
    (u.searchParams.get('hang') ? '&hang=1' : '') + (u.searchParams.get('every') ? `&every=${u.searchParams.get('every')}` : '');
  if (!FIXED) {
    const up = await fetch(url);
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    for await (const chunk of up.body) res.write(chunk);
    return res.end();
  }
  const signal = clientGone(res);
  const up = await fetch(url, { signal });
  res.writeHead(200, { 'content-type': 'application/x-ndjson' });
  await pipeline(Readable.fromWeb(up.body), idleTimeout(UPSTREAM_IDLE_MS), res, { signal });
}

// --- shutdown ---
if (FIXED) {
  process.on('SIGTERM', () => {
    draining = true;                         // /health -> 503, LB stops routing
    setTimeout(() => {
      server.close(() => process.exit(0));   // stop accepting, wait in-flight
      server.closeIdleConnections();
      setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 10_000).unref();
    }, DRAIN_DELAY_MS);
  });
}
