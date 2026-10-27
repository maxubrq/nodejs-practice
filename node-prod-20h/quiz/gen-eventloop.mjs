// Sinh câu hỏi thứ tự thực thi theo seed. Đáp án lấy từ runtime, chạy mỗi câu RUNS lần (mặc định 100; 40 lần từng để lọt một câu có race, xem PLAN mục Sửa sai),
// câu nào cho hơn một thứ tự thì bỏ (race thật, không phải kiến thức).
//   node quiz/gen-eventloop.mjs --seed 7 --count 12 --out quiz/out/seed7
// Tạo: questions.md (chỉ code, không đáp án), key.json, và qNN.cjs để tự chạy lại.
// Câu hỏi: "chuỗi chữ cái in ra là gì?". Mỗi câu có 6–10 nhãn, lồng tối đa 3 tầng.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const SEED = Number(opt('--seed', 1)), COUNT = Number(opt('--count', 12)), RUNS = Number(opt('--runs', 100));
const OUT = opt('--out', `quiz/out/seed${SEED}`);
const ESM = args.includes('--esm');

// mulberry32: cùng seed → cùng bộ câu trên mọi máy
let s = SEED >>> 0;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const KINDS = ['sync', 'tick', 'then', 'qm', 'timeout', 'immediate', 'io', 'await', 'async-fn'];
const wrap = {
  tick: (b) => `process.nextTick(() => {\n${b}\n})`,
  then: (b) => `Promise.resolve().then(() => {\n${b}\n})`,
  qm: (b) => `queueMicrotask(() => {\n${b}\n})`,
  timeout: (b) => `setTimeout(() => {\n${b}\n}, 0)`,
  immediate: (b) => `setImmediate(() => {\n${b}\n})`,
  io: (b) => `fs.stat(__filename, () => {\n${b}\n})`,
  await: (b) => `(async () => {\n  await null;\n${b}\n})()`,
  'async-fn': (b) => `(async () => {\n${b.split('\n').slice(0, 1).join('\n')}\n  await Promise.resolve();\n${b.split('\n').slice(1).join('\n')}\n})()`,
};
const indent = (t) => t.split('\n').map((l) => '  ' + l).join('\n');

function gen() {
  let label = 0;
  const L = () => String.fromCharCode(65 + label++);
  const node = (depth) => {
    const k = depth >= 3 ? pick(KINDS.slice(0, 6)) : pick(KINDS);
    if (k === 'sync') return `log('${L()}');`;
    const lines = [`log('${L()}');`];
    const kids = depth < 3 ? Math.floor(rnd() * 3) : 0;
    for (let i = 0; i < kids && label < 10; i++) lines.push(node(depth + 1));
    if (k === 'async-fn') lines.push(`log('${L()}');`);
    return wrap[k](indent(lines.join('\n'))) + ';';
  };
  const top = [];
  while (label < 6) top.push(node(1));
  return top.join('\n');
}

const header = ESM
  ? `import fs from 'node:fs';\nconst __filename = new URL(import.meta.url).pathname;\nconst o = []; const log = (x) => o.push(x);\nprocess.on('exit', () => console.log(o.join('')));\n`
  : `const fs = require('fs');\nconst o = []; const log = (x) => o.push(x);\nprocess.on('exit', () => console.log(o.join('')));\n`;
const ext = ESM ? 'mjs' : 'cjs';

fs.mkdirSync(OUT, { recursive: true });
const key = { seed: SEED, node: process.version, module: ESM ? 'esm' : 'cjs', runs: RUNS, answers: {} };
let md = `# Câu hỏi thứ tự thực thi — seed ${SEED} (${ESM ? 'ESM' : 'CommonJS'}, file chính)\n\nMỗi câu: chuỗi chữ cái in ra là gì? \`log\` đẩy nhãn vào mảng, in ở 'exit'.\nGhi dự đoán + độ tự tin 1–5 vào journal.csv TRƯỚC khi chạy.\n\n`;
let made = 0, rejected = 0;
while (made < COUNT && rejected < COUNT * 20) {
  const body = gen();
  const src = header + body + '\n';
  const f = path.join(OUT, `tmp.${ext}`);
  fs.writeFileSync(f, src);
  const outs = new Set();
  for (let i = 0; i < RUNS && outs.size < 2; i++) outs.add(execFileSync(process.execPath, [f], { encoding: 'utf8' }).trim());
  if (outs.size > 1) { rejected++; continue; }
  made++;
  const id = `g${String(made).padStart(2, '0')}`;
  fs.renameSync(f, path.join(OUT, `${id}.${ext}`));
  key.answers[id] = [...outs][0];
  md += `## ${id}\n\n\`\`\`js\n${body}\n\`\`\`\n\n`;
}
try { fs.unlinkSync(path.join(OUT, `tmp.${ext}`)); } catch {}
key.rejectedAsRacy = rejected;
fs.writeFileSync(path.join(OUT, 'questions.md'), md);
fs.writeFileSync(path.join(OUT, 'key.json'), JSON.stringify(key, null, 2));
console.log(`seed=${SEED} giữ ${made} câu, bỏ ${rejected} câu có race (sau ${RUNS} lần chạy). → ${OUT}`);
