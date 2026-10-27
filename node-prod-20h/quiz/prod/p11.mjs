// Q: Client ngắt ở 50 ms; handler gọi res.end() ở 200 ms. res.end() có ném không? 'close' của res chạy lúc nào, writableFinished?
import http from 'node:http';
const out = [];
const s = http.createServer((req, res) => {
  const t0 = Date.now();
  res.on('close', () => out.push(`close@${Math.round((Date.now() - t0) / 50) * 50}ms finished=${res.writableFinished}`));
  setTimeout(() => {
    try { res.end('late'); out.push('end-no-throw'); } catch (e) { out.push(`throw ${e.code}`); }
    setTimeout(() => { console.log(out.join(' | ')); s.close(); }, 20);
  }, 200);
}).listen(0, () => {
  const req = http.get(`http://127.0.0.1:${s.address().port}/`);
  req.on('error', () => {});
  setTimeout(() => req.destroy(), 50);
});
