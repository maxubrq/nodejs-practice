// In mọi giá trị mặc định liên quan production, đo trên runtime đang chạy.
// Chạy: node tools/defaults.mjs            (in JSON một dòng)
//       node tools/defaults.mjs --pretty
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import v8 from 'node:v8';
import dns from 'node:dns';
import events from 'node:events';
import stream from 'node:stream';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const out = {};
out.versions = {
  node: process.versions.node, v8: process.versions.v8, uv: process.versions.uv,
  undici: process.versions.undici, llhttp: process.versions.llhttp,
};

// 1. http.Server
const srv = http.createServer();
out.httpServer = {
  keepAliveTimeout: srv.keepAliveTimeout,
  keepAliveTimeoutBuffer: srv.keepAliveTimeoutBuffer,
  headersTimeout: srv.headersTimeout,
  requestTimeout: srv.requestTimeout,
  timeout: srv.timeout,
  maxHeadersCount: srv.maxHeadersCount,
  maxRequestsPerSocket: srv.maxRequestsPerSocket,
  maxConnections: srv.maxConnections,
  maxHeaderSize: http.maxHeaderSize,
};

// 2. http.globalAgent (client http/https của Node, không phải fetch)
const a = http.globalAgent;
out.httpGlobalAgent = {
  keepAlive: a.keepAlive, keepAliveMsecs: a.keepAliveMsecs, maxSockets: String(a.maxSockets),
  maxTotalSockets: String(a.maxTotalSockets), maxFreeSockets: a.maxFreeSockets, timeout: a.options.timeout,
  scheduling: a.scheduling, agentKeepAliveTimeoutBuffer: a.agentKeepAliveTimeoutBuffer,
  httpsSameAsHttp: https.globalAgent.keepAlive === a.keepAlive,
};

// 3. fetch / undici: kích hoạt global dispatcher rồi đọc options
{
  const s = http.createServer((q, r) => r.end('ok')).listen(0);
  await events.once(s, 'listening');
  await (await fetch(`http://127.0.0.1:${s.address().port}/`)).text();
  const d = globalThis[Symbol.for('undici.globalDispatcher.1')];
  const opt = {};
  for (const sym of Object.getOwnPropertySymbols(d)) {
    const v = d[sym];
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Map) && sym.description?.includes('options')) Object.assign(opt, v);
  }
  out.fetch = {
    dispatcher: d?.constructor?.name,
    optionsSetOnGlobalDispatcher: opt,
    note: 'fetch không có timeout tổng; headersTimeout/bodyTimeout mặc định nằm trong undici Client (xem PLAN mục 3)',
  };
  s.close();
}

// 4. net
out.net = {
  autoSelectFamily: net.getDefaultAutoSelectFamily(),
  autoSelectFamilyAttemptTimeout: net.getDefaultAutoSelectFamilyAttemptTimeout(),
  dnsResultOrder: dns.getDefaultResultOrder(),
};

// 5. stream
const rs = fs.createReadStream(new URL(import.meta.url));
out.stream = {
  defaultHWM_bytes: stream.getDefaultHighWaterMark(false),
  defaultHWM_objectMode: stream.getDefaultHighWaterMark(true),
  fsReadStreamHWM: rs.readableHighWaterMark,
  bufferPoolSize: Buffer.poolSize,
  platform: process.platform,
};
rs.destroy();

// 6. threadpool: đếm luồng libuv-worker sau khi gọi một API dùng pool
await new Promise((r) => crypto.pbkdf2('x', 's', 1, 32, 'sha256', r));
await sleep(50);
let workers = null;
try {
  workers = fs.readdirSync('/proc/self/task')
    .map((t) => fs.readFileSync(`/proc/self/task/${t}/comm`, 'utf8').trim())
    .filter((n) => n.startsWith('libuv-worker')).length;
} catch {}
out.threadpool = {
  UV_THREADPOOL_SIZE_env: process.env.UV_THREADPOOL_SIZE ?? null,
  libuvWorkerThreads: workers,
  availableParallelism: os.availableParallelism(),
  cpus: os.cpus().length,
};

// 7. bộ nhớ
const hs = v8.getHeapStatistics();
out.memory = {
  heap_size_limit_MB: +(hs.heap_size_limit / 2 ** 20).toFixed(1),
  constrainedMemory_MB: process.constrainedMemory() ? +(process.constrainedMemory() / 2 ** 20).toFixed(1) : 0,
  totalmem_MB: Math.round(os.totalmem() / 2 ** 20),
};

// 8. lỗi và sự kiện
out.misc = {
  unhandledRejectionsFlag: process.execArgv.find((x) => x.startsWith('--unhandled-rejections')) ?? '(mặc định: throw)',
  defaultMaxListeners: events.defaultMaxListeners,
  captureRejections: events.captureRejections,
};

srv.close();
console.log(process.argv.includes('--pretty') ? JSON.stringify(out, null, 2) : JSON.stringify(out));
