// Health probe chạy ở tiến trình riêng, như một kubelet hay LB: GET /health mỗi 50 ms qua 1 kết nối keep-alive,
// timeout 1 s. Nó thấy đúng thứ người dùng thấy khi event loop của service bị chặn.
// Dùng: fork('tools/probe.mjs', [url]); gửi 'stop' → nhận lại số đo.
import http from 'node:http';
import { request, summarize } from './load.mjs';

const url = process.argv[2];
const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
const results = [];
let running = true;
process.on('message', (m) => { if (m === 'stop') running = false; });
(async () => {
  while (running) {
    const t = performance.now();
    results.push(await request(agent, { url, timeoutMs: 1000 }));
    const wait = 50 - (performance.now() - t);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  const s = summarize(results);
  s.errors = results.filter((r) => !(r.outcome === 'status' && r.status === 200)).length;
  process.send(s, () => process.exit(0));
})();
