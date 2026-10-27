// Q: Client gửi body 1 MB, server trả 413 ngay mà không đọc body (không đặt Connection: close).
//    Client gửi request thứ hai trên cùng kết nối keep-alive. Nó nhận được gì?
import http from "node:http";
const s = http
  .createServer((q, r) => {
    r.statusCode = 413;
    r.end();
  })
  .listen(0);
await new Promise((r) => s.on("listening", r));
const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
const body = Buffer.alloc(1 << 20);
const send = (b) =>
  new Promise((resolve) => {
    const req = http.request(
      {
        port: s.address().port,
        method: "POST",
        agent,
        headers: { "content-length": b.length },
      },
      (res) => {
        res.resume();
        res.on("end", () =>
          resolve(
            `${res.statusCode}${res.headers.connection ? "/" + res.headers.connection : ""}`,
          ),
        );
      },
    );
    req.on("error", (e) => resolve(e.code));
    req.end(b);
  });
const a = await send(body);
const b = await send(Buffer.from("{}"));
console.log(`first=${a} second=${b}`);
agent.destroy();
s.close();
