// Q: events.defaultMaxListeners là bao nhiêu, và vượt ngưỡng thì Node làm gì: ném lỗi, cảnh báo, hay im lặng?
import { EventEmitter } from "node:events";
const warnings = [];
process.on("warning", (w) => warnings.push(w.name));
const e = new EventEmitter();
for (let i = 0; i < 11; i++) e.on("x", () => {});
setTimeout(
  () =>
    console.log(
      `default=${EventEmitter.defaultMaxListeners} listeners=${e.listenerCount("x")} warnings=${warnings.join(",") || "none"}`,
    ),
  10,
);
