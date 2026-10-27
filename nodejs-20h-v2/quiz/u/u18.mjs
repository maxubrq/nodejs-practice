// 50 concurrent fetch() to one origin, default global dispatcher, server holds each 200 ms.
// About how many TCP connections does the server see: ~1, ~10, ~50?
import http from 'node:http';
let conns = 0;
const s = http.createServer((q, r) => setTimeout(() => r.end('ok'), 200));
s.on('connection', () => conns++);
await new Promise((r) => s.listen(0, r));
await Promise.all(Array.from({ length: 50 }, () => fetch(`http://127.0.0.1:${s.address().port}/`).then((r) => r.text())));
console.log(conns >= 45 ? '~50' : conns > 5 ? '~10' : '~1');
s.closeAllConnections(); s.close();
