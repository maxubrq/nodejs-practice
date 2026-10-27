// Reproduce intermittent 502: backend keep-alive shorter than LB idle timeout.
// node h502.mjs <backendKeepAliveMs> [loops=20] [iters=30]
// Backend socket really closes at keepAliveTimeout + keepAliveTimeoutBuffer (1000 ms default since v24.6.0).
// Client gaps are drawn around that instant so the LB reuses connections right as the backend closes them.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

const KA = +process.argv[2] || 100;
const LOOPS = +process.argv[3] || 1, ITERS = +process.argv[4] || 60;
const BUSY = process.env.BUSY_MS || '0';
const NODE = process.execPath;
const SVC = new URL('../service/', import.meta.url).pathname;
const start = (f, env, ready) => new Promise((res, rej) => {
  const p = spawn(NODE, [SVC + f], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
  p.stdout.on('data', (d) => String(d).includes(ready) && res(p));
  p.on('exit', (c) => rej(new Error(f + ' exit ' + c)));
});
const get = (url, agent) => new Promise((res) => {
  const r = http.get(url, { agent }, (rs) => { rs.resume(); rs.on('end', () => res(rs.statusCode)); });
  r.on('error', (e) => res(e.code));
});

const O = +process.env.PORT_OFFSET || 0;
const db = await start('fakedb.mjs', { DB_PORT: String(7001 + O), CTL_PORT: String(7002 + O) }, 'fakedb ready');
const be = await start('service.mjs', { MODE: 'fixed', PORT: String(8080 + O), DB_PORT: String(7001 + O), KEEPALIVE_MS: String(KA), BUSY_MS: BUSY }, 'service');
const lb = await start('lb.mjs', { BACKENDS: `127.0.0.1:${8080 + O}`, LB_PORT: String(9000 + O), LB_STATS_PORT: String(9001 + O), LB_IDLE_MS: '60000', HC_MS: '100000' }, 'lb on');
const closeAt = +process.env.GAP_MS || KA + 1000;
const agent = new http.Agent({ keepAlive: true });
const codes = {};
await Promise.all(Array.from({ length: LOOPS }, async (_, i) => {
  await sleep(i * (closeAt / LOOPS));
  for (let k = 0; k < ITERS; k++) {
    const c = await get(`http://127.0.0.1:${9000 + O}/user/1`, agent);
    codes[c] = (codes[c] || 0) + 1;
    await sleep(closeAt - 30 + Math.random() * 60);
  }
}));
const s = await (await fetch(`http://127.0.0.1:${9001 + O}/`)).json();
console.log(JSON.stringify({ node: process.version, backendKeepAliveMs: KA, backendBusyMs: +BUSY, socketClosesAtMs: closeAt, lbIdleMs: 60000, requests: LOOPS * ITERS, codes, lbFresh: s.fresh, lbReused: s.reused, reasons: s.reasons }));
for (const p of [db, be, lb]) p.kill('SIGKILL');
process.exit(0);
