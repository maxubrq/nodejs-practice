// Q: Có 1 kết nối keep-alive đang rảnh. server.close(cb): cb chạy ngay hay đợi keepAliveTimeout (5 s)?
import http from 'node:http';
const s = http.createServer((q, r) => r.end('ok')).listen(0);
await new Promise((r) => s.on('listening', r));
const agent = new http.Agent({ keepAlive: true });
await new Promise((r) => http.get({ port: s.address().port, agent }, (res) => { res.resume(); res.on('end', r); }));
const t = performance.now();
s.close(() => { console.log(`closed after ${performance.now() - t < 1000 ? '<1s' : '>=1s'}`); agent.destroy(); });
