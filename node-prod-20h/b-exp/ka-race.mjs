// Quét khoảng nghỉ quanh lúc backend đóng kết nối keep-alive, xem request nào chết.
// Backend (tiến trình riêng): keepAliveTimeout=K, keepAliveTimeoutBuffer=0, tức đóng socket rảnh sau đúng K ms.
// Client: agent kiểu ALB (bỏ qua hint, giữ socket 60 s), đi qua relay trễ D ms mỗi chiều (RTT = 2D).
// Dùng: node b-exp/ka-race.mjs [K=200] [D=1]
import http from 'node:http';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';

if (process.argv[2] === '--server') {
  const K = Number(process.argv[3]);
  const s = http.createServer({ keepAliveTimeout: K, keepAliveTimeoutBuffer: 0 }, (q, r) => r.end('ok'));
  s.listen(0, '127.0.0.1', () => process.send(s.address().port));
} else {
  const K = Number(process.argv[2] ?? 200), D = Number(process.argv[3] ?? 1);
  const self = import.meta.filename;
  const srv = fork(self, ['--server', K]);
  const [port] = await once(srv, 'message');
  const rp = port + 1;
  const relay = fork(path.join(import.meta.dirname, '../tools/delay.mjs'), [rp, port, D]);
  await once(relay, 'message');

  class AlbAgent extends http.Agent {
    keepSocketAlive(s) { s.setKeepAlive(true, 1000); s.unref(); s.setTimeout(60_000); return true; }
  }
  const agent = new AlbAgent({ keepAlive: true, maxSockets: 1 });
  const get = () => new Promise((res) => {
    const req = http.get({ port: rp, host: '127.0.0.1', agent }, (r) => { r.resume(); r.on('end', () => res('ok')); });
    req.on('error', (e) => res(e.code || e.message));
  });
  const sleepExact = (ms) => new Promise((r) => {
    const t = performance.now();
    setTimeout(function spin() { performance.now() - t >= ms ? r() : setImmediate(spin); }, Math.max(0, ms - 3));
  });
  const by = {};
  for (let gap = K - 2 * D - 4; gap <= K + 2 * D + 4; gap += 0.5) {
    for (let rep = 0; rep < 4; rep++) {
      await get();                                      // socket vừa được dùng: đồng hồ rảnh bắt đầu
      await sleepExact(gap);
      (by[gap] ??= []).push(await get());
    }
  }
  console.log(JSON.stringify({ node: process.versions.node, K, D }));
  for (const [g, rs] of Object.entries(by)) console.log(String(g).padStart(6), rs.join(' '));
  relay.kill(); srv.kill(); agent.destroy();
}
