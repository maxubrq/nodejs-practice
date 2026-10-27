// Fault-injection harness. Usage: node faults/run.mjs <naive|fixed> [scenario...]
// Starts fakedb + service (and LB for sigterm), injects each fault, prints one JSON line per scenario.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import autocannon from 'autocannon';

const MODE = process.argv[2] || 'naive';
const ONLY = process.argv.slice(3);
const NODE = process.env.NODE_BIN || process.execPath;
const SVC = new URL('../service/', import.meta.url).pathname;

function start(file, env, ready) {
  const p = spawn(NODE, [SVC + file], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stderrBuf = '';
  p.stderr.on('data', (d) => (p.stderrBuf += d));
  return new Promise((res, rej) => {
    p.stdout.on('data', (d) => { if (String(d).includes(ready)) res(p); });
    p.on('exit', (c) => rej(new Error(`${file} exited ${c}: ${p.stderrBuf}`)));
  });
}
const get = (url, opts = {}) => new Promise((res, rej) => {
  const r = http.get(url, { agent: false, ...opts }, (rs) => { let b = ''; rs.on('data', (d) => (b += d)); rs.on('end', () => res({ status: rs.statusCode, body: b })); });
  r.on('error', rej);
});
const json = async (url) => JSON.parse((await get(url)).body);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))].toFixed(1) : null; };

// External health probe: one keep-alive connection, request every 50 ms, latency as seen by a client.
function healthProbe(port) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  const lat = []; let stop = false, fails = 0; const failCodes = {};
  (async () => {
    while (!stop) {
      const t = performance.now();
      try { await get(`http://127.0.0.1:${port}/health`, { agent }); lat.push(performance.now() - t); } catch (e) { fails++; failCodes[e.code] = (failCodes[e.code] || 0) + 1; lat.push(performance.now() - t); }
      await sleep(50);
    }
  })();
  return () => { stop = true; agent.destroy(); return { healthP99: pct(lat, 99), healthMax: pct(lat, 100), healthFails: fails, ...(fails ? { healthFailCodes: JSON.stringify(failCodes) } : {}) }; };
}
const cannon = (opts) => autocannon({ connections: 50, duration: 5, timeout: 10, ...opts });
const summ = (r) => ({ reqs: r.requests.total, p50: r.latency.p50, p99: r.latency.p99, ok2xx: r['2xx'], non2xx: r.non2xx, errors: r.errors, timeouts: r.timeouts });

const scenarios = {
  async baseline() {
    const probe = healthProbe(8080);
    const r = await cannon({ url: 'http://127.0.0.1:8080/user/1' });
    return { ...summ(r), ...probe() };
  },
  async dbSlow() {
    await get('http://127.0.0.1:7002/mode?delay=5000');
    const probe = healthProbe(8080);
    const r = await cannon({ url: 'http://127.0.0.1:8080/user/1', connections: 100, duration: 8 });
    const m = await json('http://127.0.0.1:8080/metrics');
    await get('http://127.0.0.1:7002/mode?delay=5');
    return { ...summ(r), ...probe(), dbPendingAfter: m.dbPending };
  },
  async dbDown() {
    await get('http://127.0.0.1:7002/mode?down=1');
    await sleep(300);
    const probe = healthProbe(8080);
    const r = await cannon({ url: 'http://127.0.0.1:8080/user/1', duration: 5, timeout: 3 });
    const m = await json('http://127.0.0.1:8080/metrics');
    await get('http://127.0.0.1:7002/mode?down=0');
    return { ...summ(r), ...probe(), dbQueuedDuringOutage: m.dbQueued };
  },
  async clientDisconnect() {
    const N = 50;
    await Promise.all(Array.from({ length: N }, () => new Promise((res) => {
      const r = http.get('http://127.0.0.1:8080/export?rows=10000000&every=100', { agent: false }, (rs) => {
        rs.once('data', () => setTimeout(() => { r.destroy(); res(); }, 200));
      });
      r.on('error', res);
    })));
    await sleep(1500);
    const up = await json('http://127.0.0.1:7002/stats');
    const m = await json('http://127.0.0.1:8080/metrics');
    return { clients: N, upstreamStillOpen: up.activeStreams, serviceInflight: m.inflight - 1 };
  },
  async streamHang() {
    const N = 20, CLIENT_TIMEOUT = 10_000;
    const t0 = performance.now();
    const ends = await Promise.all(Array.from({ length: N }, () => new Promise((res) => {
      const r = http.get('http://127.0.0.1:8080/export?rows=10&hang=1', { agent: false }, (rs) => {
        rs.resume();
        rs.on('end', () => res({ by: 'server-end', ms: performance.now() - t0 }));
        rs.on('error', () => res({ by: 'server-abort', ms: performance.now() - t0 }));
        rs.on('aborted', () => res({ by: 'server-abort', ms: performance.now() - t0 }));
      });
      r.setTimeout(CLIENT_TIMEOUT, () => { r.destroy(); res({ by: 'client-timeout', ms: performance.now() - t0 }); });
      r.on('error', () => res({ by: 'server-abort', ms: performance.now() - t0 }));
    })));
    await sleep(1000);
    const up = await json('http://127.0.0.1:7002/stats');
    const byServer = ends.filter((e) => e.by !== 'client-timeout');
    return { clients: N, closedByServer: byServer.length, closeMsMax: pct(byServer.map((e) => e.ms), 100), clientTimeouts: N - byServer.length, upstreamStillOpen: up.activeStreams };
  },
  async payload50mb() {
    const items = Array.from({ length: 50 * 1024 }, (_, i) => 'x'.repeat(1000) + i);
    const body = Buffer.from(JSON.stringify({ items }));
    await get('http://127.0.0.1:8080/metrics?reset');
    const probe = healthProbe(8080);
    const base = (await json('http://127.0.0.1:8080/metrics')).rss;
    const statuses = await Promise.all(Array.from({ length: 4 }, () => new Promise((res) => {
      const r = http.request('http://127.0.0.1:8080/ingest', { method: 'POST', agent: false, headers: { 'content-length': body.length } }, (rs) => { rs.resume(); rs.on('end', () => res(rs.statusCode)); });
      r.on('error', (e) => res(e.code));
      r.end(body);
    })));
    await sleep(300);
    const m = await json('http://127.0.0.1:8080/metrics');
    return { bodyMB: +(body.length / 2 ** 20).toFixed(1), statuses: statuses.join(','), rssBaseMB: +(base / 2 ** 20).toFixed(0), rssMaxMB: +(m.maxRss / 2 ** 20).toFixed(0), loopLagMaxMs: m.maxLagMs, ...probe() };
  },
  async redos() {
    const probe = healthProbe(8080);
    await sleep(300);
    const t = performance.now();
    const r = await get('http://127.0.0.1:8080/validate?name=' + 'a'.repeat(+process.env.REDOS_N || 28) + '!');
    const reqMs = +(performance.now() - t).toFixed(1);
    await sleep(200);
    return { status: r.status, reqMs, ...probe() };
  },
};

async function sigterm() {
  const env = { MODE, KEEPALIVE_MS: '65000' };
  const b1 = await start(process.env.SERVICE_FILE || 'service.mjs', { ...env, PORT: '8080' }, 'service');
  const b2 = await start(process.env.SERVICE_FILE || 'service.mjs', { ...env, PORT: '8082' }, 'service');
  const lb = await start('lb.mjs', { BACKENDS: '127.0.0.1:8080,127.0.0.1:8082', LB_IDLE_MS: '60000' }, 'lb on');
  await get('http://127.0.0.1:7002/mode?delay=50');
  await sleep(500);
  setTimeout(() => b1.kill('SIGTERM'), 2000);
  const r = await cannon({ url: 'http://127.0.0.1:9000/user/1', duration: 6 });
  const s = await json('http://127.0.0.1:9001/');
  const b1Exit = b1.exitCode ?? b1.signalCode;
  for (const p of [b1, b2, lb]) p.kill('SIGKILL');
  await get('http://127.0.0.1:7002/mode?delay=5');
  return { ...summ(r), lb502: s.s502, lb502Reasons: JSON.stringify(s.reasons), backend1Exit: b1Exit };
}

const db = await start('fakedb.mjs', {}, 'fakedb ready');
const out = [];
for (const name of [...Object.keys(scenarios), 'sigterm']) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  let row;
  if (name === 'sigterm') row = await sigterm();
  else {
    const svc = await start(process.env.SERVICE_FILE || 'service.mjs', { MODE, PORT: '8080' }, 'service');
    await sleep(200);
    try { row = await scenarios[name](); } catch (e) { row = { harnessError: e.message }; }
    row.serviceAlive = svc.exitCode === null && svc.signalCode === null;
    if (!row.serviceAlive) row.serviceExit = (svc.exitCode ?? svc.signalCode) + ' ' + svc.stderrBuf.split('\n').find((l) => /Error|error/.test(l));
    svc.kill('SIGKILL');
    await sleep(300);
  }
  const line = { node: process.version, mode: MODE, scenario: name, ...row };
  console.log(JSON.stringify(line));
  out.push(line);
}
db.kill('SIGKILL');
process.exit(0);
