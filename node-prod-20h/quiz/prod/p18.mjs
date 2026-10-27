// Q: Chỉ có một AbortSignal.timeout(1000) đang chờ. Tiến trình có đợi 1 s để in 'abort' không?
import { spawnSync } from "node:child_process";
const t = performance.now();
const r = spawnSync(
  process.execPath,
  [
    "-e",
    `AbortSignal.timeout(1000).addEventListener('abort', () => console.log('abort'))`,
  ],
  { encoding: "utf8" },
);
console.log(
  `stdout=${r.stdout.trim() || "(trống)"} took=${performance.now() - t < 800 ? "<0.8s" : ">=0.8s"}`,
);
