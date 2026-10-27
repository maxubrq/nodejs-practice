// Q: 'beforeExit' có chạy khi gọi process.exit(0) không? Khi loop tự hết việc thì sao?
import { spawnSync } from "node:child_process";
const run = (code) =>
  spawnSync(process.execPath, ["-e", code], { encoding: "utf8" })
    .stdout.trim()
    .replace(/\n/g, ",") || "(trống)";
const a = run(
  `process.on('beforeExit', () => console.log('beforeExit')); process.exit(0)`,
);
const b = run(
  `let n = 0; process.on('beforeExit', () => { if (n++ < 1) setTimeout(() => console.log('again'), 1); else console.log('beforeExit'); })`,
);
console.log(`explicitExit=${a} naturalExit=${b}`);
