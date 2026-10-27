// Server advertises Keep-Alive timeout=1 (keepAliveTimeout 1000). Does Node's http.Agent reuse the socket for a 2nd request 100 ms later?
import http from 'node:http';
const s = http.createServer((q, r) => r.end('ok')); s.keepAliveTimeout = 1000;
await new Promise((r) => s.listen(0, r));
const agent = new http.Agent({ keepAlive: true });
const get = () => new Promise((res) => { const r = http.get({ port: s.address().port, agent }, (x) => { x.resume(); x.on('end', () => res(r.reusedSocket)); }); });
await get(); await new Promise((r) => setTimeout(r, 100));
console.log('reusedSocket:', await get());
agent.destroy(); s.close();
