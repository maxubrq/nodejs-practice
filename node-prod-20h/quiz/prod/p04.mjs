// Q: Listener async của EventEmitter ném lỗi (captureRejections mặc định). Tiến trình thoát mã nào?
import { spawnSync } from "node:child_process";
const r = spawnSync(
  process.execPath,
  [
    "-e",
    `
  const { EventEmitter } = require('events');
  const e = new EventEmitter();
  e.on('error', () => console.log('error-listener'));
  e.on('job', async () => { throw new Error('boom'); });
  e.emit('job');
  setTimeout(() => console.log('alive'), 10);
`,
  ],
  { encoding: "utf8" },
);
console.log(
  `stdout=${r.stdout.trim().replace(/\n/g, ",") || "(trống)"} exit=${r.status}`,
);
