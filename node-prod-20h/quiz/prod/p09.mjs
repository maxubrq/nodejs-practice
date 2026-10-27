// Q: Server nhận kết nối nhưng không bao giờ trả header. fetch với AbortSignal.timeout(100) ném lỗi tên gì?
import http from "node:http";
const s = http.createServer(() => {}).listen(0);
await new Promise((r) => s.on("listening", r));
try {
  await fetch(`http://127.0.0.1:${s.address().port}/`, {
    signal: AbortSignal.timeout(100),
  });
} catch (e) {
  console.log(`name=${e.name}`);
}
s.closeAllConnections();
s.close();
