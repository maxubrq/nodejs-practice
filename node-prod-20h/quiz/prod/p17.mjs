// Q: Server mặc định trả header Keep-Alive gì?
import http from "node:http";
const s = http
  .createServer((q, r) => r.end("ok"))
  .listen(0, () => {
    http.get(
      { port: s.address().port, agent: new http.Agent({ keepAlive: true }) },
      (res) => {
        console.log(`keep-alive: ${res.headers["keep-alive"]}`);
        res.resume();
        res.socket.destroy();
        s.close();
      },
    );
  });
