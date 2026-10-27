// Q: Cùng tình huống p05 nhưng dùng pipeline(). Đích có bị hủy không? Callback nhận lỗi gì?
import { Readable, Writable, pipeline } from "node:stream";
const src = new Readable({ read() {} });
const dst = new Writable({
  write(c, e, cb) {
    cb();
  },
});
pipeline(src, dst, (err) =>
  setTimeout(
    () => console.log(`dst.destroyed=${dst.destroyed} err=${err?.message}`),
    10,
  ),
);
src.push("a");
setTimeout(() => src.destroy(new Error("boom")), 10);
