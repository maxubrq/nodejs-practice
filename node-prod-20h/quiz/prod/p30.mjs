// Q: http.get không truyền agent: socket có được giữ lại cho request sau không? (http.globalAgent.keepAlive)
import http from "node:http";
const s = http.createServer((q, r) => r.end("ok")).listen(0);
await new Promise((r) => s.on("listening", r));
const get = () =>
  new Promise((r) =>
    http.get(`http://127.0.0.1:${s.address().port}/`, (res) => {
      res.resume();
      const port = res.socket.localPort;
      res.on("end", () => r(port));
    }),
  );
const a = await get();
const b = await get();
console.log(
  `globalAgent.keepAlive=${http.globalAgent.keepAlive} reused=${a === b}`,
);
http.globalAgent.destroy();
s.close();
