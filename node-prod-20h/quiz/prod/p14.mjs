// Q: Một request đang chạy 300 ms thì server.close(). Thứ tự: response hoàn tất hay callback close trước?
import http from "node:http";
const out = [];
const s = http
  .createServer((q, r) => setTimeout(() => r.end("done"), 300))
  .listen(0, () => {
    http.get(`http://127.0.0.1:${s.address().port}/`, (res) => {
      res.resume();
      res.on("end", () => out.push("response"));
    });
    setTimeout(
      () =>
        s.close(() => {
          out.push("closed");
          setTimeout(() => console.log(out.join(" < ")), 20);
        }),
      50,
    );
  });
