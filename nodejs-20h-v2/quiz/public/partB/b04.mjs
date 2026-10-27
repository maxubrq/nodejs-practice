import http from 'node:http';
const s = http.createServer((q, r) => r.end('ok'));
await new Promise((r) => s.listen(0, r));
const agent = new http.Agent({ keepAlive: true });
await new Promise((r) => http.get({ port: s.address().port, agent }, (x) => { x.resume(); x.on('end', r); }));
const t = performance.now();
s.close(() => console.log('close callback after', performance.now() - t < 1000 ? '< 1 s' : '>= 1 s'));
setTimeout(() => agent.destroy(), 7000).unref();
