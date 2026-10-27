// Q: require() một file .mjs: (1) không có top-level await; (2) có top-level await.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'q26-'));
fs.writeFileSync(path.join(d, 'a.mjs'), 'export const a = 1;');
fs.writeFileSync(path.join(d, 'b.mjs'), 'await null; export const b = 2;');
const run = (f) => {
  const r = spawnSync(process.execPath, ['-e', `try { console.log(JSON.stringify(require(${JSON.stringify(path.join(d, f))}))) } catch (e) { console.log(e.code) }`], { encoding: 'utf8' });
  return r.stdout.trim();
};
console.log(`noTLA=${run('a.mjs')} withTLA=${run('b.mjs')}`);
fs.rmSync(d, { recursive: true });
