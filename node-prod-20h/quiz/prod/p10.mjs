// Q: Server gửi header ngay rồi treo body. fetch(signal=timeout 200 ms): fetch resolve hay reject? text() thì sao?
import http from "node:http";
const s = http
  .createServer((q, r) => {
    r.writeHead(200);
    r.write("a");
  })
  .listen(0);
await new Promise((r) => s.on("listening", r));
const res = await fetch(`http://127.0.0.1:${s.address().port}/`, {
  signal: AbortSignal.timeout(200),
});
let t;
try {
  await res.text();
  t = "ok";
} catch (e) {
  t = e.name;
}
console.log(`fetch=resolved status=${res.status} text=${t}`);
s.closeAllConnections();
s.close();
