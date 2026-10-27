// Vì sao Node làm PID 1 sống sót sau SIGTERM, dù Node có cài handler mặc định cho SIGTERM?
// Đọc mặt nạ SigCgt (tín hiệu đang có handler) trong /proc trước và sau khi gửi SIGTERM.
// Cần Linux + root (unshare --pid). Dùng: node b-exp/pid1-sigterm.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIGTERM_BIT = 1n << 14n; // tín hiệu 15 → bit 14
const caught = (pid) => (BigInt('0x' + fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/SigCgt:\s+(\w+)/)[1]) & SIGTERM_BIT) !== 0n;
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

async function trial(pid1, code) {
  const args = pid1 ? ['--pid', '--fork', '--mount-proc', '--kill-child', process.execPath, '-e', code] : ['-e', code];
  const c = spawn(pid1 ? 'unshare' : process.execPath, args, { stdio: 'ignore' });
  await sleep(400);
  const pid = pid1 ? Number(fs.readFileSync(`/proc/${c.pid}/task/${c.pid}/children`, 'utf8').trim()) : c.pid;
  const before = caught(pid);
  process.kill(pid, 'SIGTERM'); await sleep(300);
  const r = { pid1, handler: code.includes('SIGTERM') ? 'process.on(SIGTERM)' : 'mặc định', sigtermCaughtBefore: before,
    aliveAfter1: alive(pid), sigtermCaughtAfter1: alive(pid) ? caught(pid) : null };
  if (alive(pid)) { process.kill(pid, 'SIGTERM'); await sleep(300); r.aliveAfter2 = alive(pid); }
  if (alive(pid)) process.kill(pid, 'SIGKILL');
  c.kill('SIGKILL');
  return r;
}

console.log(JSON.stringify({ node: process.versions.node }));
console.table([
  await trial(false, 'setInterval(() => {}, 1000)'),
  await trial(true, 'setInterval(() => {}, 1000)'),
  await trial(true, "process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000)"),
]);
