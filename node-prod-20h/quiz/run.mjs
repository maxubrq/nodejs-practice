// Chạy bộ câu production (quiz/prod/pNN.mjs) và sinh / kiểm khóa đáp án từ runtime.
//   node quiz/run.mjs --write-key quiz/key-v24.json   # chạy mỗi câu RUNS lần (mặc định 5), ghi mọi output khác nhau
//   node quiz/run.mjs --check-key quiz/key-v24.json   # chạy lại trên máy bạn, in câu nào khác khóa
//   node quiz/run.mjs --diff quiz/key-v24.json quiz/key-v26.json
//   node quiz/run.mjs --only p11,p23
// Khóa ghi MỌI output đã thấy; câu có nhiều output là câu có race hoặc phụ thuộc thời gian máy, ghi "racy".
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.QUIZ_DIR ? path.resolve(process.env.QUIZ_DIR) : path.join(import.meta.dirname, 'prod');
const args = process.argv.slice(2);
const flag = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const RUNS = Number(process.env.RUNS || 5);

if (args[0] === '--diff') {
  const [a, b] = [JSON.parse(fs.readFileSync(args[1])), JSON.parse(fs.readFileSync(args[2]))];
  let same = 0;
  for (const k of Object.keys(a.answers)) {
    const x = a.answers[k].outputs.join(' || '), y = b.answers[k]?.outputs.join(' || ');
    if (x === y) same++; else console.log(`${k}\n  ${a.node}: ${x}\n  ${b.node}: ${y}`);
  }
  console.log(`giống nhau: ${same}/${Object.keys(a.answers).length}`);
  process.exit(0);
}

const only = flag('--only')?.split(',');
const files = fs.readdirSync(DIR).filter((f) => /^p\d+\.mjs$/.test(f) && (!only || only.includes(f.slice(0, -4)))).sort();
const answers = {};
for (const f of files) {
  const seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    let out;
    try { out = execFileSync(process.execPath, [path.join(DIR, f)], { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch (e) { out = `CRASH exit=${e.status} ${String(e.stdout || '').trim()}`; }
    seen.add(out);
  }
  answers[f.slice(0, -4)] = { outputs: [...seen].sort(), racy: seen.size > 1 };
  process.stderr.write('.');
}
process.stderr.write('\n');

if (flag('--write-key')) {
  fs.writeFileSync(flag('--write-key'), JSON.stringify({ node: process.version, runs: RUNS, answers }, null, 2));
  console.log(`đã ghi ${flag('--write-key')}`);
} else if (flag('--check-key')) {
  const key = JSON.parse(fs.readFileSync(flag('--check-key')));
  let ok = 0;
  for (const [k, v] of Object.entries(answers)) {
    const exp = key.answers[k]?.outputs ?? [];
    if (v.outputs.every((o) => exp.includes(o))) ok++;
    else console.log(`${k}: khóa(${key.node}) = ${exp.join(' || ')}\n     máy bạn(${process.version}) = ${v.outputs.join(' || ')}`);
  }
  console.log(`khớp ${ok}/${Object.keys(answers).length}. Khác nhau: runtime đúng, khóa sai.`);
} else {
  for (const [k, v] of Object.entries(answers)) console.log(`${k}: ${v.outputs.join(' || ')}${v.racy ? '   [racy]' : ''}`);
}
