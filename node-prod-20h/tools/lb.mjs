// Load balancer L7 giả lập hành vi kiểu AWS ALB:
// - giữ kết nối keep-alive tới backend tối đa IDLE_MS (mặc định 60 s) và KHÔNG đọc hint `Keep-Alive: timeout=N`;
// - health check GET /health mỗi HC_MS, 1 lần lỗi là rút, 1 lần đạt là thêm lại;
// - lỗi kết nối tới backend → 502 kèm header x-lb-error.
// - NODES > 1: mở NODES cổng liên tiếp, mỗi cổng là một "node" của LB với pool kết nối riêng (ALB có nhiều node).
// Dùng: fork('tools/lb.mjs', [port, 'p1,p2', HC_MS, IDLE_MS, NODES=1])
import http from 'node:http';

const [port, list, hcMs = '200', idleMs = '60000', nodes = '1'] = process.argv.slice(2);
const backends = list.split(',').map((p) => ({ port: Number(p), healthy: true }));

class AlbAgent extends http.Agent {
  keepSocketAlive(socket) {            // bỏ qua hint của backend, như ALB
    socket.setKeepAlive(true, 1000);
    socket.unref();
    socket.setTimeout(Number(idleMs));
    return true;
  }
}
const stats = { proxied: 0, e502: {}, noBackend: 0 };
// Header hop-by-hop chỉ có nghĩa trên một chặng; LB không chuyển tiếp chúng (RFC 9110 mục 7.6.1).
const HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'te', 'upgrade', 'trailer']);
const hop = (h) => Object.fromEntries(Object.entries(h).filter(([k]) => !HOP.has(k)));

let rr = 0, listening = 0;
for (let i = 0; i < Number(nodes); i++) {
  const agent = new AlbAgent({ keepAlive: true, scheduling: 'lifo' });
  http.createServer((req, res) => {
    const healthy = backends.filter((b) => b.healthy);
    if (!healthy.length) { stats.noBackend++; res.statusCode = 503; return res.end('no healthy backend'); }
    const b = healthy[rr++ % healthy.length];
    const up = http.request({ port: b.port, host: '127.0.0.1', method: req.method, path: req.url, headers: hop(req.headers), agent });
    up.on('response', (ur) => { stats.proxied++; res.writeHead(ur.statusCode, hop(ur.headers)); ur.pipe(res); });
    up.on('error', (e) => {
      const k = e.code || e.message; stats.e502[k] = (stats.e502[k] || 0) + 1;
      if (!res.headersSent) { res.writeHead(502, { 'x-lb-error': k }); res.end('bad gateway'); } else res.destroy();
    });
    req.pipe(up);
  }).listen(Number(port) + i, '127.0.0.1', () => { if (++listening === Number(nodes)) process.send?.({ ready: true }); });
}

const hcAgent = new http.Agent({ keepAlive: false });
setInterval(() => {
  for (const b of backends) {
    const r = http.get({ port: b.port, host: '127.0.0.1', path: '/health', agent: hcAgent, timeout: 150 }, (res) => {
      b.healthy = res.statusCode === 200; res.resume();
    });
    r.on('timeout', () => r.destroy(new Error('hc timeout')));
    r.on('error', () => { b.healthy = false; });
  }
}, Number(hcMs)).unref();

process.on('message', (m) => { if (m === 'stats') process.send({ stats }); });
