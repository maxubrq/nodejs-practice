// Q: Gắn .catch trong setTimeout 0, sau khi đã reject. Thoát mã nào?
import { spawnSync } from "node:child_process";
const r = spawnSync(
  process.execPath,
  [
    "-e",
    `
  const p = Promise.reject(new Error('boom'));
  setTimeout(() => p.catch(() => console.log('caught')), 0);
`,
  ],
  { encoding: "utf8" },
);
console.log(`stdout=${r.stdout.trim() || "(trống)"} exit=${r.status}`);
