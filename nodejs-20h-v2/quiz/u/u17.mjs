// Server sends headers then stalls. fetch() with AbortSignal.timeout(300).
// Does `await fetch()` resolve? What error, from where?
import http from 'node:http';
const s = http.createServer((q, r) => { r.writeHead(200); r.write('partial'); });
await new Promise((r) => s.listen(0, r));
const res = await fetch(`http://127.0.0.1:${s.address().port}/`, { signal: AbortSignal.timeout(300) });
console.log('fetch resolved', res.status);
try { await res.text(); } catch (e) { console.log('text() rejected', e.name); }
s.closeAllConnections(); s.close();
