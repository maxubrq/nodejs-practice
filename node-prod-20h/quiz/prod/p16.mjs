// Q: Server keepAliveTimeout 1000 ms. http.Agent keep-alive mặc định gọi 2 lần cách nhau 100 ms. Lần 2 dùng lại socket?
import http from "node:http";
const s = http
  .createServer({ keepAliveTimeout: 1000 }, (q, r) => r.end("ok"))
  .listen(0);
await new Promise((r) => s.on("listening", r));
const agent = new http.Agent({ keepAlive: true });
const get = () =>
  new Promise((r) =>
    http.get({ port: s.address().port, agent }, (res) => {
      res.resume();
      const port = res.socket.localPort;
      res.on("end", () => r(port));
    }),
  );
const a = await get();
await new Promise((r) => setTimeout(r, 100));
const b = await get();
console.log(`reused=${a === b}`);
agent.destroy();
s.close();
