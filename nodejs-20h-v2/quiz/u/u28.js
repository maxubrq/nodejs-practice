// res.write() after client disconnected (no 'error' listener on res). Crash?
const http = require('http');
const s = http.createServer((req, res) => {
  res.writeHead(200); res.write('a');
  setTimeout(() => { const ok = res.write('b'); console.log('write after disconnect returned', ok); s.close(); }, 200);
});
s.listen(0, () => { const r = http.get({ port: s.address().port, agent: false }, (x) => { x.once('data', () => r.destroy()); }); r.on('error', () => {}); });
process.on('exit', (c) => console.log('exit', c));
