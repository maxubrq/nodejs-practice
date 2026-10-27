// LỜI GIẢI THAM KHẢO. Đừng mở trước khi mine.mjs của bạn đạt tiêu chí hoặc bạn đã hết 100 phút của block.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { pipeline } from 'node:stream';
import { config, instrument } from '../service/_runtime.mjs';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// ---------- Pool: hàng đợi có giới hạn, deadline, hủy query, fail fast khi DB sập ----------
class Pool {
  constructor(size, maxQueue) {
    this.maxQueue = maxQueue; this.queue = [];
    this.conns = Array.from({ length: size }, () => this.connect({ backoff: 50 }));
  }
  get anyUp() { return this.conns.some((c) => c.ok); }
  connect(c) {
    c.busy = null; c.buf = ''; c.ok = false;
    c.sock = net.connect(config.dbPort, '127.0.0.1');
    c.sock.on('connect', () => { c.ok = true; c.backoff = 50; this.pump(); });
    c.sock.on('data', (d) => {
      c.buf += d;
      let i;
      while ((i = c.buf.indexOf('\n')) >= 0) {
        const line = c.buf.slice(0, i); c.buf = c.buf.slice(i + 1);
        const job = c.busy; c.busy = null;
        job?.done(null, line);
        this.pump();
      }
    });
    c.sock.on('error', () => {});
    c.sock.on('close', () => {
      c.ok = false;
      c.busy?.done(new HttpError(503, 'db connection lost')); c.busy = null;
      if (!this.anyUp) for (const j of this.queue.splice(0)) j.done(new HttpError(503, 'db down'));
      setTimeout(() => this.connect(c), c.backoff); c.backoff = Math.min(c.backoff * 2, 2000);
    });
    return c;
  }
  query(signal) {
    if (!this.anyUp) return Promise.reject(new HttpError(503, 'db down'));            // fail fast
    if (this.queue.length >= this.maxQueue) return Promise.reject(new HttpError(503, 'pool saturated'));
    if (signal.aborted) return Promise.reject(new HttpError(504, 'deadline'));
    return new Promise((resolve, reject) => {
      const job = {
        done: (err, v) => { signal.removeEventListener('abort', onAbort); err ? reject(err) : resolve(v); },
      };
      const onAbort = () => {
        const qi = this.queue.indexOf(job);
        if (qi >= 0) this.queue.splice(qi, 1);
        const c = this.conns.find((x) => x.busy === job);
        if (c) { c.busy = null; c.sock.destroy(); }      // hủy query đang chạy: DB thấy client đi
        job.done(new HttpError(504, 'deadline'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.queue.push(job); this.pump();
    });
  }
  pump() {
    for (const c of this.conns) {
      if (!this.queue.length) return;
      if (c.ok && !c.busy) { c.busy = this.queue.shift(); c.sock.write('Q\n'); }
    }
  }
}
const pool = new Pool(10, 100);

// Bulkhead cho việc dùng threadpool nặng: chừa luồng cho fs/dns.
function semaphore(n) {
  let active = 0; const wait = [];
  return async (fn) => {
    if (active >= n) await new Promise((r) => wait.push(r));
    active++;
    try { return await fn(); } finally { active--; wait.shift()?.(); }
  };
}
const hashSlot = semaphore(2);
const pbkdf2 = (...a) => new Promise((res, rej) => crypto.pbkdf2(...a, (e, k) => (e ? rej(e) : res(k))));

const configBus = new EventEmitter();
const VALID_NAME = /^[a-zA-Z0-9]+(?: [a-zA-Z0-9]+)*$/;  // tuyến tính: mỗi nhánh bắt đầu bằng ký tự khác nhau
const BODY_LIMIT = 1 << 20;

let draining = false;

function clientGone(res) {
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableFinished) ac.abort(); });
  return ac.signal;
}

async function handle(req, res, url) {
  switch (url.pathname) {
    case '/health':
      if (draining) { res.statusCode = 503; return res.end('draining'); }
      return res.end('ok');

    case '/user': {
      const signal = AbortSignal.any([AbortSignal.timeout(300), clientGone(res)]);
      const row = await pool.query(signal);
      return res.end(JSON.stringify({ row }));
    }

    case '/export': {
      const mode = url.searchParams.get('mode') === 'hang' ? 'hang' : 'normal';
      const up = http.get(`${config.upstream}/stream?mode=${mode}`, { signal: clientGone(res) });
      up.setTimeout(2000, () => up.destroy(new Error('upstream idle 2s')));
      up.on('error', () => { if (!res.headersSent) { res.statusCode = 502; res.end(); } else res.destroy(); });
      up.on('response', (upRes) => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        pipeline(upRes, res, () => {});                    // lỗi ở một đầu hủy cả hai đầu
      });
      return;
    }

    case '/ingest': {
      if (Number(req.headers['content-length']) > BODY_LIMIT) throw new HttpError(413, 'too large');
      const chunks = []; let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > BODY_LIMIT) throw new HttpError(413, 'too large');
        chunks.push(c);
      }
      let items;
      try { items = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new HttpError(400, 'bad json'); }
      return res.end(JSON.stringify({ count: items.length }));
    }

    case '/validate': {
      const name = url.searchParams.get('name') || '';
      const ok = name.length <= 64 && VALID_NAME.test(name);
      res.statusCode = ok ? 200 : 400;
      return res.end(ok ? 'valid' : 'invalid');
    }

    case '/notify': {
      fetch(`${config.upstream}/audit`, { signal: AbortSignal.timeout(2000) })
        .then(async (r) => { await r.body?.cancel(); if (!r.ok) throw new Error(`audit ${r.status}`); })
        .catch((e) => console.error('audit failed (ignored):', e.message));
      res.statusCode = 202;
      return res.end('queued');
    }

    case '/avatar': {
      const key = await hashSlot(() => pbkdf2('password', 'salt', 150_000, 64, 'sha512'));
      return res.end(key.toString('hex').slice(0, 16));
    }

    case '/config': {
      const data = await fs.promises.readFile(new URL('../service/config.json', import.meta.url));
      return res.end(data);
    }

    case '/sub': {
      const ctx = { id: Math.random(), payload: new Array(1250).fill(Math.random()) };
      const fn = () => ctx.payload.length;
      configBus.on('change', fn);
      res.on('close', () => configBus.off('change', fn)); // đời của listener = đời của request
      return res.end('subscribed');
    }
  }
  res.statusCode = 404; res.end();
}

const server = http.createServer({ keepAliveTimeout: 65_000, headersTimeout: 66_000 }, (req, res) => {
  if (draining) res.setHeader('connection', 'close');
  handle(req, res, new URL(req.url, 'http://x')).catch((err) => {
    const status = err.status || 500;
    if (res.headersSent) return res.destroy();
    res.statusCode = status;
    if (status === 413) res.setHeader('connection', 'close');
    res.end(err.message);
  });
});

process.on('SIGTERM', () => {
  if (draining) return;
  draining = true;                                       // 1. /health → 503, LB rút backend
  setTimeout(() => {                                      // 2. đợi > chu kỳ health check của LB
    server.close(() => process.exit(0));                  // 3. ngừng nhận kết nối mới, đợi request đang chạy
    server.closeIdleConnections();
    setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 10_000).unref();
  }, 1000);
});

instrument(server);
