// Harness bơm lỗi. Mỗi kịch bản khởi động service MỚI trong cgroup 256 MB, bơm lỗi, đo từ bên ngoài.
// Dùng:
//   node faults/run.mjs naive                         # bản naive
//   SERVICE_FILE=service/mine.mjs node faults/run.mjs mine
//   node faults/run.mjs fixed                         # lời giải (chỉ chạy sau khi bạn tự làm)
//   node faults/run.mjs naive --only F1,F7
// Kết quả: in bảng và ghi results-faults-<impl>-v<major>.jsonl
// Cần Linux + root cho cgroup và unshare. Không có root: NO_CGROUP=1 (F5 khi đó không bị kernel giết).
import { fork } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { load, summarize, request } from '../tools/load.mjs';
import http from 'node:http';

const ROOT = path.resolve(import.meta.dirname, '..');
const impl = process.argv[2] || 'naive';
const SERVICE = path.resolve(ROOT, process.env.SERVICE_FILE ||
  (impl === 'fixed' ? '_solutions/fixed.mjs' : `service/${impl}.mjs`));
const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg > 0 ? process.argv[onlyArg + 1].split(',') : null;
const NODE = process.execPath;
const major = process.versions.node.split('.')[0];
// RESULTS_TAG cho các lần chạy thí nghiệm (vd. TAG=tp16) để không ghi đè kết quả chính.
const OUT = path.join(ROOT, `results-faults-${impl}-v${major}${process.env.RESULTS_TAG ? '-' + process.env.RESULTS_TAG : ''}.jsonl`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MB = (b) => +(b / 2 ** 20).toFixed(1);

// Dưới dải cổng tạm của Linux (32768–60999) để không đụng cổng nguồn của kết nối đi ra.
let portBase = 10000 + Math.floor(Math.random() * 150) * 100;
const ports = () => { portBase += 100; return { svc: portBase, svc2: portBase + 1, db: portBase + 3, up: portBase + 4, ctrl: portBase + 5, lb: portBase + 50 }; };

// Đợi tiến trình con báo sẵn sàng; nếu nó chết trước thì báo lỗi thay vì treo.
function ready(c) {
  return new Promise((res, rej) => {
    c.on('message', (m) => m?.ready && res());
    c.on('exit', (code, sig) => rej(new Error(`child exited early: ${code ?? sig}`)));
  });
}

async function ctrl(p, q) {
  const r = await fetch(`http://127.0.0.1:${p.ctrl}${q}`); return r.json();
}

async function startDeps(p) {
  const c = fork(path.join(ROOT, 'faults/deps.mjs'), [p.db, p.up, p.ctrl], { execPath: NODE, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  await ready(c);
  return c;
}

function startService(p, port, { pid1 = false, name = 'svc' } = {}) {
  const env = { ...process.env, PORT: port, DB_PORT: p.db, UP_PORT: p.up, SVC_NAME: name };
  let execPath = path.join(ROOT, 'tools/incg.sh'), execArgv = ['256M', NODE, '--expose-gc'];
  if (process.env.NO_CGROUP) { execPath = NODE; execArgv = ['--expose-gc']; }
  if (pid1) { execPath = 'unshare'; execArgv = ['--pid', '--fork', '--mount-proc', '--kill-child', NODE, '--expose-gc']; }
  const c = fork(SERVICE, [], { execPath, execArgv, env, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const s = { c, rssMax: 0, lagMax: 0, eluMax: 0, exit: null, stderr: '', gcHeap: null };
  c.stderr.on('data', (d) => { if (s.stderr.length < 4000) s.stderr += d; });
  c.on('message', (m) => {
    if (m.m) { s.rssMax = Math.max(s.rssMax, m.m.rss); s.lagMax = Math.max(s.lagMax, m.m.lag); s.eluMax = Math.max(s.eluMax, m.m.elu); }
    if (m.gc != null) s.gcHeap = m.gc;
  });
  s.exited = new Promise((r) => c.on('exit', (code, signal) => { s.exit = { code, signal, at: performance.now() }; r(); }));
  s.ready = new Promise((r, j) => { c.on('message', (m) => m.ready && r()); c.on('exit', () => j(new Error('service exited: ' + s.stderr))); });
  return s;
}

// Số lần kernel OOM-kill trong cgroup của service (cgroup v1: memory.oom_control; v2: memory.events).
function oomKills(s) {
  for (const f of [`/sys/fs/cgroup/memory/np20h_${s.c.pid}/memory.oom_control`, `/sys/fs/cgroup/np20h_${s.c.pid}/memory.events`]) {
    try { return Number(fs.readFileSync(f, 'utf8').match(/oom_kill (\d+)/)[1]); } catch {}
  }
  return null;
}

async function gcHeap(s) {
  s.gcHeap = null; s.c.send({ cmd: 'gc' });
  for (let i = 0; i < 50 && s.gcHeap == null; i++) await sleep(20);
  return s.gcHeap;
}

function startProbe(url) {
  const c = fork(path.join(ROOT, 'tools/probe.mjs'), [url], { execPath: NODE });
  return { stop: async () => { c.send('stop'); const [m] = await once(c, 'message'); return m; } };
}

async function stop(...procs) {
  for (const s of procs) {
    const c = s.c || s;
    if (c.exitCode === null && c.signalCode === null) { c.kill('SIGKILL'); await once(c, 'exit').catch(() => {}); }
  }
}

// Một kịch bản chuẩn: deps + 1 service + probe. fn trả về đối tượng số đo riêng.
async function standard(fn) {
  const p = ports();
  const deps = await startDeps(p);
  const svc = startService(p, p.svc);
  await svc.ready;
  const base = `http://127.0.0.1:${p.svc}`;
  const probe = startProbe(`${base}/health`);
  await sleep(300);
  let res;
  try { res = await fn({ p, base, svc }); } finally {
    const pr = await probe.stop();
    res = { ...res, probe: { n: pr.n, errors: pr.errors, p99: pr.p99, max: pr.max },
      rssMaxMB: MB(svc.rssMax), lagMaxMs: +svc.lagMax.toFixed(1), eluMax: +svc.eluMax.toFixed(2),
      serviceExit: svc.exit ? `${svc.exit.signal || 'code ' + svc.exit.code}` : 'alive', oomKill: oomKills(svc) };
    await stop(svc, deps);
  }
  return res;
}

const S = {};

S.F1 = () => standard(async ({ p, base }) => {
  await ctrl(p, '/db?latency=5000');
  const r = await load({ url: `${base}/user`, conns: 100, durationMs: 8000, timeoutMs: 10_000 });
  await ctrl(p, '/mark'); await sleep(1500);
  const d = await ctrl(p, '/stats');
  return { load: summarize(r), dbInflightAfter: d.inflight, dbStartedAfterLoad: d.startedAfterMark };
});

S.F2 = () => standard(async ({ p, base }) => {
  await ctrl(p, '/db/down'); await sleep(200);
  const r = await load({ url: `${base}/user`, conns: 50, durationMs: 5000, timeoutMs: 3000 });
  return { load: summarize(r) };
});

S.F3 = () => standard(async ({ p, base }) => {
  const r = await load({ url: `${base}/export`, conns: 50, requests: 50, timeoutMs: 5000, abortAfterMs: 200 });
  await sleep(1500);
  const d = await ctrl(p, '/stats');
  return { load: summarize(r), upstreamOpenAfter: d.upstreamOpen, upstreamOpened: d.upstreamOpened };
});

S.F4 = () => standard(async ({ p, base }) => {
  const r = await load({ url: `${base}/export?mode=hang`, conns: 20, requests: 20, timeoutMs: 10_000 });
  await sleep(500);
  const d = await ctrl(p, '/stats');
  const closed = r.filter((x) => x.outcome === 'serverClose' || x.outcome === 'status' || x.outcome === 'err');
  return { load: summarize(r), closedByServer: closed.length, closeMaxMs: closed.length ? +Math.max(...closed.map((x) => x.ms)).toFixed(0) : null, upstreamOpenAfter: d.upstreamOpen };
});

S.F5 = () => standard(async ({ base }) => {
  const body = Buffer.from('[' + '1,'.repeat(30 * 2 ** 20 - 1) + '1]');   // ~60 MB JSON
  const r = await Promise.all(Array.from({ length: 4 }, () =>
    request(new http.Agent(), { url: `${base}/ingest`, method: 'POST', body, headers: { 'content-type': 'application/json' }, timeoutMs: 20_000 })));
  await sleep(500);
  return { payloadMB: MB(body.length), load: summarize(r) };
});

S.F6 = () => standard(async ({ base }) => {
  const evil = 'a'.repeat(27) + '!';
  const r = await load({ url: `${base}/validate?name=${evil}`, conns: 3, requests: 3, timeoutMs: 30_000 });
  return { load: summarize(r) };
});

S.F7 = async () => {
  const p = ports();
  const deps = await startDeps(p);
  const b1 = startService(p, p.svc, { name: 'b1' }), b2 = startService(p, p.svc2, { name: 'b2' });
  await Promise.all([b1.ready, b2.ready]);
  const lb = fork(path.join(ROOT, 'tools/lb.mjs'), [p.lb, `${p.svc},${p.svc2}`, 200, 60000], { execPath: NODE });
  await ready(lb);
  await sleep(500);
  const t0 = performance.now();
  const killer = sleep(2000).then(() => { b1.killedAt = performance.now(); b1.c.kill('SIGTERM'); });
  const r = await load({ url: `http://127.0.0.1:${p.lb}/user`, conns: 20, durationMs: 6000, timeoutMs: 5000 });
  await killer;
  await Promise.race([b1.exited, sleep(12_000)]);
  lb.send('stats'); const [{ stats }] = await once(lb, 'message');
  const s = summarize(r);
  const non2xx = r.filter((x) => !(x.outcome === 'status' && x.status < 300)).length;
  const out = { load: s, non2xx, lb502: stats.e502,
    b1Exit: b1.exit ? `${b1.exit.signal || 'code ' + b1.exit.code} sau ${(b1.exit.at - b1.killedAt).toFixed(0)} ms` : 'còn sống sau 12 s' };
  await stop(lb, b1, b2, deps);
  void t0;
  return out;
};

S.F8 = async () => {
  const p = ports();
  const deps = await startDeps(p);
  const b = startService(p, p.svc);
  await b.ready;
  // RTT 2 ms giữa LB và backend (1 ms mỗi chiều), như hai máy trong cùng VPC.
  const delay = fork(path.join(ROOT, 'tools/delay.mjs'), [p.svc2, p.svc, 1], { execPath: NODE });
  await ready(delay);
  const lb = fork(path.join(ROOT, 'tools/lb.mjs'), [p.lb, `${p.svc2}`, 60_000, 60_000, 30], { execPath: NODE });
  await ready(lb);
  // LB có 30 node, mỗi node một pool kết nối riêng; client i đi qua node i, tuần tự.
  // Mỗi client nghỉ 6000 ± 25 ms giữa 2 request: đúng lúc backend mặc định đóng kết nối rảnh
  // (keepAliveTimeout 5 s + keepAliveTimeoutBuffer 1 s). LB coi kết nối còn sống tới 60 s.
  const results = [];
  await Promise.all(Array.from({ length: 30 }, async (_, i) => {
    const ag = new http.Agent({ keepAlive: false });
    await sleep(i * 20);
    for (let k = 0; k < 9; k++) {
      results.push(await request(ag, { url: `http://127.0.0.1:${p.lb + i}/health`, timeoutMs: 3000 }));
      await sleep(5975 + Math.random() * 50);
    }
  }));
  lb.send('stats'); const [{ stats }] = await once(lb, 'message');
  await stop(lb, delay, b, deps);
  return { load: summarize(results), lb502: stats.e502 };
};

S.F9 = () => standard(async ({ base }) => {
  const first = await request(new http.Agent(), { url: `${base}/notify` });
  await sleep(300);
  const r = await load({ url: `${base}/health`, conns: 10, durationMs: 2000, timeoutMs: 1000 });
  return { notify: first.status ?? first.code, load: summarize(r) };
});

S.F10 = () => standard(async ({ base }) => {
  const [heavy, victim] = await Promise.all([
    load({ url: `${base}/avatar`, conns: 8, durationMs: 5000, timeoutMs: 20_000 }),
    load({ url: `${base}/config`, conns: 4, durationMs: 5000, timeoutMs: 20_000 }),
  ]);
  return { load: summarize(victim), avatar: summarize(heavy) };
});

S.F11 = () => standard(async ({ base, svc }) => {
  const before = await gcHeap(svc);
  const r = await load({ url: `${base}/sub`, conns: 20, requests: 5000, timeoutMs: 5000 });
  await sleep(300);
  const after = await gcHeap(svc);
  return { load: summarize(r), heapGrowthAfterGcMB: MB(after - before), maxListenersWarning: /MaxListenersExceeded/.test(svc.stderr) };
});

S.F12 = async () => {
  const p = ports();
  const deps = await startDeps(p);
  const s = startService(p, p.svc, { pid1: true });
  await s.ready;
  // fork() trả về pid của `unshare`; node là con của nó và là PID 1 trong namespace mới.
  const nodePid = Number(fs.readFileSync(`/proc/${s.c.pid}/task/${s.c.pid}/children`, 'utf8').trim().split(' ')[0]);
  const nsPid = fs.readFileSync(`/proc/${nodePid}/status`, 'utf8').match(/NSpid:\s+(.*)/)[1].trim().split(/\s+/).join(' → ');
  const t = performance.now();
  process.kill(nodePid, 'SIGTERM');
  let alive = true;
  for (let i = 0; i < 50 && alive; i++) { await sleep(100); try { process.kill(nodePid, 0); } catch { alive = false; } }
  const out = { nsPid, afterSigterm: alive ? 'còn sống sau 5 s (docker stop sẽ SIGKILL sau 10 s)' : `thoát sau ${(performance.now() - t).toFixed(0)} ms` };
  try { process.kill(nodePid, 'SIGKILL'); } catch {}
  await stop(s, deps);
  return out;
};

const order = Object.keys(S).filter((k) => !ONLY || ONLY.includes(k));
fs.writeFileSync(OUT, '');
console.log(`impl=${impl} file=${path.relative(ROOT, SERVICE)} node=${process.version}`);
for (const k of order) {
  const t = performance.now();
  let row;
  try { row = await S[k](); } catch (e) { row = { error: String(e.message).slice(0, 300) }; }
  row = { fault: k, impl, node: process.versions.node, sec: +((performance.now() - t) / 1000).toFixed(1), ...row };
  fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
  console.log(JSON.stringify(row));
}
