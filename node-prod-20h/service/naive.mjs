// Service mẫu, bản NAIVE. Code này giống code production thật mà bạn sẽ gặp: chạy đúng khi mọi thứ ổn.
// Nhiệm vụ: chép sang service/mine.mjs và sửa tới khi đạt tiêu chí trong faults/CRITERIA.md.
// Đừng đổi tên route hay định dạng response thành công: harness dựa vào chúng.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { config, instrument } from './_runtime.mjs';

// ---------- Pool kết nối DB: 10 kết nối, hàng đợi không giới hạn, chờ vô hạn khi DB sập ----------
class Pool {
  constructor(size) {
    this.queue = [];
    this.conns = Array.from({ length: size }, () => this.connect({}));
  }
  connect(c) {
    c.busy = null; c.buf = ''; c.ok = false;
    c.sock = net.connect(config.dbPort, '127.0.0.1');
    c.sock.on('connect', () => { c.ok = true; this.pump(); });
    c.sock.on('data', (d) => {
      c.buf += d;
      let i;
      while ((i = c.buf.indexOf('\n')) >= 0) {
        const line = c.buf.slice(0, i); c.buf = c.buf.slice(i + 1);
        const job = c.busy; c.busy = null;
        job?.resolve(line);
        this.pump();
      }
    });
    c.sock.on('error', () => {});
    c.sock.on('close', () => {
      c.ok = false;
      if (c.busy) { this.queue.unshift(c.busy); c.busy = null; } // thử lại sau
      setTimeout(() => this.connect(c), 100);                    // kết nối lại mãi mãi
    });
    return c;
  }
  query() {
    return new Promise((resolve, reject) => { this.queue.push({ resolve, reject }); this.pump(); });
  }
  pump() {
    for (const c of this.conns) {
      if (!this.queue.length) return;
      if (c.ok && !c.busy) { c.busy = this.queue.shift(); c.sock.write('Q\n'); }
    }
  }
}
const pool = new Pool(10);

const configBus = new EventEmitter();
const VALID_NAME = /^([a-zA-Z0-9]+\s?)+$/;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  switch (url.pathname) {
    case '/health':
      return res.end('ok');

    case '/user': {                                      // F1, F2
      const row = await pool.query();
      return res.end(JSON.stringify({ row }));
    }

    case '/export': {                                    // F3, F4
      const mode = url.searchParams.get('mode') || 'normal';
      http.get(`${config.upstream}/stream?mode=${mode}`, (up) => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        up.pipe(res);
      });
      return;
    }

    case '/ingest': {                                    // F5
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const items = JSON.parse(body.toString());
        res.end(JSON.stringify({ count: items.length }));
      });
      return;
    }

    case '/validate': {                                  // F6
      const ok = VALID_NAME.test(url.searchParams.get('name') || '');
      res.statusCode = ok ? 200 : 400;
      return res.end(ok ? 'valid' : 'invalid');
    }

    case '/notify': {                                    // F9
      fetch(`${config.upstream}/audit`).then((r) => {
        if (!r.ok) throw new Error(`audit failed: ${r.status}`);
      });
      res.statusCode = 202;
      return res.end('queued');
    }

    case '/avatar': {                                    // F10
      crypto.pbkdf2('password', 'salt', 150_000, 64, 'sha512', (err, key) => {
        res.end(key.toString('hex').slice(0, 16));
      });
      return;
    }

    case '/config': {                                    // F10 (nạn nhân)
      fs.readFile(new URL('./config.json', import.meta.url), (err, data) => res.end(data));
      return;
    }

    case '/sub': {                                       // F11
      const ctx = { id: Math.random(), payload: new Array(1250).fill(Math.random()) }; // ~10 KB trên heap
      configBus.on('change', () => ctx.payload.length);
      return res.end('subscribed');
    }
  }
  res.statusCode = 404; res.end();
});

instrument(server);
