// Phụ thuộc giả của service: DB (TCP), upstream (HTTP), cổng điều khiển (HTTP).
// Mọi số đếm ở đây đo service TỪ BÊN NGOÀI: service không thể nói dối chúng.
//   DB_PORT    giao thức dòng: client gửi "Q\n", DB trả "R <n>\n" sau `latency` ms (mỗi kết nối xử lý tuần tự).
//   UP_PORT    GET /stream?mode=normal|hang   GET /audit (luôn 500)
//   CTRL_PORT  GET /db?latency=ms  /db/down  /db/up  /mark  /stats
import net from 'node:net';
import http from 'node:http';

const [DB_PORT, UP_PORT, CTRL_PORT] = process.argv.slice(2).map(Number);
const st = { latency: 5, dbUp: true, queriesStarted: 0, queriesDone: 0, inflight: 0, markAt: 0,
  startedAfterMark: 0, upstreamOpen: 0, upstreamOpened: 0, dbConns: 0, auditCalls: 0 };

// ---------- DB ----------
const dbSockets = new Set();
function onDbConn(sock) {
  dbSockets.add(sock); st.dbConns++;
  let buf = '';
  let chain = Promise.resolve();
  let alive = true;
  let running = null;   // query đang chạy trên kết nối này
  // Client đóng kết nối = backend Postgres bị terminate: query đang chạy dừng theo.
  sock.on('close', () => {
    alive = false; dbSockets.delete(sock); st.dbConns--;
    if (running) { clearTimeout(running.t); st.inflight--; st.cancelled = (st.cancelled || 0) + 1; running.resolve(); running = null; }
  });
  sock.on('error', () => {});
  sock.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      buf = buf.slice(i + 1);
      // Mỗi kết nối xử lý tuần tự, như một backend Postgres.
      chain = chain.then(() => new Promise((resolve) => {
        if (!alive) return resolve();
        st.queriesStarted++; st.inflight++;
        if (st.markAt) st.startedAfterMark++;
        running = { resolve, t: setTimeout(() => {
          running = null;
          st.inflight--; st.queriesDone++;
          if (alive) sock.write(`R ${st.queriesDone}\n`);
          resolve();
        }, st.latency) };
      }));
    }
  });
}
let dbServer = net.createServer(onDbConn).listen(DB_PORT);
function dbDown() {
  if (!st.dbUp) return; st.dbUp = false;
  dbServer.close();
  for (const s of dbSockets) s.destroy();
}
function dbUpAgain() {
  if (st.dbUp) return; st.dbUp = true;
  dbServer = net.createServer(onDbConn).listen(DB_PORT);
}

// ---------- Upstream ----------
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/audit') { st.auditCalls++; res.statusCode = 500; return res.end('audit down'); }
  if (u.pathname === '/stream') {
    const mode = u.searchParams.get('mode') || 'normal';
    st.upstreamOpen++; st.upstreamOpened++;
    res.on('close', () => { st.upstreamOpen--; clearInterval(t); });
    res.writeHead(200, { 'content-type': 'text/plain' });
    let n = 0;
    const t = setInterval(() => {
      if (mode === 'hang' && n >= 10) return;           // gửi 10 dòng rồi im lặng mãi
      res.write(`line ${n++} ${'x'.repeat(100)}\n`);
      if (n >= 1000) { clearInterval(t); res.end(); }     // bình thường: 1000 dòng × 10 ms = 10 s
    }, 10);
    return;
  }
  res.statusCode = 404; res.end();
}).listen(UP_PORT);

// ---------- Điều khiển ----------
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/db') st.latency = Number(u.searchParams.get('latency'));
  else if (u.pathname === '/db/down') dbDown();
  else if (u.pathname === '/db/up') dbUpAgain();
  else if (u.pathname === '/mark') { st.markAt = Date.now(); st.startedAfterMark = 0; }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(st));
}).listen(CTRL_PORT, () => process.send?.({ ready: true }));
