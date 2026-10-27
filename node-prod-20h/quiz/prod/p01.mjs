// Q: Promise bị reject, không ai bắt. Tiến trình con in gì và thoát mã nào?
import { spawnSync } from "node:child_process";
const r = spawnSync(
  process.execPath,
  [
    "-e",
    `
  Promise.reject(new Error('boom'));
  setTimeout(() => console.log('alive'), 10);
`,
  ],
  { encoding: "utf8" },
);
console.log(`stdout=${r.stdout.trim() || "(trống)"} exit=${r.status}`);
