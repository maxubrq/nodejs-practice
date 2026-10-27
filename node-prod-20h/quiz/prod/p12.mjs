// Q: Sau khi client đã đi, gọi res.write('x', cb). cb nhận lỗi mã gì?
import http from 'node:http';
const s = http.createServer((req, res) => {
  res.on('close', () => setTimeout(() => res.write('x', (err) => { console.log(`cb err=${err?.code}`); s.close(); }), 10));
}).listen(0, () => {
  const req = http.get(`http://127.0.0.1:${s.address().port}/`);
  req.on('error', () => {});
  setTimeout(() => req.destroy(), 30);
});
