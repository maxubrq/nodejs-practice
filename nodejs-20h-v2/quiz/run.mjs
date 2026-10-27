// Generate an answer key from the runtime, or check a key against the runtime on this machine.
//   node quiz/run.mjs --make-key key-v24.json [--node /path/to/node]
//   node quiz/run.mjs --check-key key-v24.json [--node /path/to/node]
//   node quiz/run.mjs --diff key-v24.json key-v26.json
// Each question runs `repeat` times (default 5); every distinct stdout is recorded, so nondeterminism is visible.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const NODE = opt('--node') || process.execPath;
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));

function questions() {
  const files = fs.readdirSync(path.join(dir, 'u')).filter((f) => /^u\d+\.(m?js)$/.test(f)).sort();
  const qs = files.map((f) => ({ id: f.replace(/\.m?js$/, ''), file: f }));
  for (const [id, m] of Object.entries(meta)) if (m.file && !qs.find((q) => q.id === id)) qs.push({ id, file: m.file });
  return qs.sort((a, b) => a.id.localeCompare(b.id)).map((q) => ({ ...q, ...(meta[q.id] || {}) }));
}

function run(q) {
  const outs = new Set();
  for (let i = 0; i < (q.repeat || 5); i++) {
    const r = spawnSync(NODE, [...(q.flags || []), path.join(dir, 'u', q.file)], {
      env: { ...process.env, ...(q.env || {}) }, encoding: 'utf8', timeout: 20_000,
    });
    outs.add(r.stdout.trim().split('\n').join(' / ') + (r.status ? `  [exit ${r.status}]` : ''));
  }
  return [...outs].sort();
}

function version() { return spawnSync(NODE, ['-v'], { encoding: 'utf8' }).stdout.trim(); }

if (args.includes('--make-key')) {
  const key = { node: version(), generated: new Date().toISOString(), answers: {} };
  for (const q of questions()) { key.answers[q.id] = run(q); console.log(q.id, JSON.stringify(key.answers[q.id])); }
  fs.writeFileSync(opt('--make-key'), JSON.stringify(key, null, 2));
} else if (args.includes('--check-key')) {
  const key = JSON.parse(fs.readFileSync(opt('--check-key'), 'utf8'));
  let bad = 0;
  console.log(`key from ${key.node}, checking on ${version()}`);
  for (const q of questions()) {
    const got = run(q), want = key.answers[q.id] || [];
    const same = JSON.stringify(got) === JSON.stringify(want);
    if (!same) { bad++; console.log(`DIFF ${q.id}\n  key:     ${JSON.stringify(want)}\n  runtime: ${JSON.stringify(got)}`); }
  }
  console.log(bad ? `${bad} question(s) differ: the runtime is right, the key is wrong for this version.` : 'all answers match the runtime');
} else if (args.includes('--diff')) {
  const [a, b] = args.slice(args.indexOf('--diff') + 1).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  for (const id of Object.keys(a.answers)) {
    if (JSON.stringify(a.answers[id]) !== JSON.stringify(b.answers[id])) console.log(`${id}\n  ${a.node}: ${JSON.stringify(a.answers[id])}\n  ${b.node}: ${JSON.stringify(b.answers[id])}`);
  }
}
