// Generate fresh, never-seen execution-order questions. Answers come from the runtime, not from a person.
//   node quiz/gen-eventloop.mjs --seed 2026 --count 12 --out quiz/gen-2026 [--node /path/node] [--runs 20]
// Each program schedules 5-7 labelled callbacks (nextTick, queueMicrotask, then, await, setTimeout 0,
// setImmediate) from a random starting context (CJS main, ESM main, I/O callback, timer, immediate).
// A program is kept only if it prints the same order in all --runs executions (default 40). A race that shows
// up 13% of the time (measured for u09) survives 40 runs with probability 0.87^40 ≈ 0.4%.
// Output: qNN.(m)js files, questions.md (code only), key.json (answers). Do not open key.json before answering.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
let seed = +opt('--seed', Date.now() % 1e9);
const COUNT = +opt('--count', 12), OUT = opt('--out', `gen-${seed}`), NODE = opt('--node', process.execPath), RUNS = +opt('--runs', 40);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const SCHED = {
  tick: (b) => `process.nextTick(() => {\n${b}\n});`,
  micro: (b) => `queueMicrotask(() => {\n${b}\n});`,
  then: (b) => `Promise.resolve().then(() => {\n${b}\n});`,
  timeout: (b) => `setTimeout(() => {\n${b}\n}, 0);`,
  immediate: (b) => `setImmediate(() => {\n${b}\n});`,
};
const CONTEXTS = {
  'cjs-main': { ext: 'js', wrap: (b) => b },
  'esm-main': { ext: 'mjs', wrap: (b) => b },
  'io-callback': { ext: 'js', wrap: (b) => `require('fs').stat(__filename, () => {\n${b}\n});` },
  'timer': { ext: 'js', wrap: (b) => `setTimeout(() => {\n${b}\n}, 0);` },
  'immediate': { ext: 'js', wrap: (b) => `setImmediate(() => {\n${b}\n});` },
};
const indent = (s) => s.split('\n').map((l) => '  ' + l).join('\n');

function program() {
  let n = 0;
  const label = () => String.fromCharCode(65 + n++);
  const block = (depth, size) => {
    const lines = [];
    for (let i = 0; i < size && n < 7; i++) {
      const kind = pick(depth < 2 ? ['tick', 'micro', 'then', 'timeout', 'immediate', 'log', 'await', 'nest'] : ['tick', 'micro', 'then', 'log']);
      if (kind === 'log') lines.push(`console.log('${label()}');`);
      else if (kind === 'await') {
        const a = label(), b = label();
        lines.push(`(async () => {\n  console.log('${a}');\n  await null;\n  console.log('${b}');\n})();`);
      } else if (kind === 'nest') {
        const outer = pick(['tick', 'then', 'timeout', 'immediate']);
        const l = label();
        lines.push(SCHED[outer](indent(`console.log('${l}');\n${block(depth + 1, 2)}`)));
      } else lines.push(SCHED[kind](indent(`console.log('${label()}');`)));
    }
    return lines.join('\n');
  };
  const ctxName = pick(Object.keys(CONTEXTS));
  const body = block(0, 6);
  return { ctxName, ext: CONTEXTS[ctxName].ext, src: CONTEXTS[ctxName].wrap(body.includes('\n') ? (ctxName.endsWith('main') ? body : indent(body)) : body) + '\n', labels: n };
}

fs.mkdirSync(OUT, { recursive: true });
const key = { node: spawnSync(NODE, ['-v'], { encoding: 'utf8' }).stdout.trim(), seed: +opt('--seed', 0), answers: {} };
let md = `# Execution-order quiz (seed ${key.seed}, ${key.node})\n\nWrite the order of printed letters for each program, e.g. \`ACBD\`. No running code.\n\n`;
let made = 0, tried = 0;
while (made < COUNT && tried < COUNT * 40) {
  tried++;
  const p = program();
  if (p.labels < 5) continue;
  const id = `g${String(made + 1).padStart(2, '0')}`;
  const file = path.join(OUT, `${id}.${p.ext}`);
  fs.writeFileSync(file, `// context: ${p.ctxName}\n${p.src}`);
  const outs = new Set();
  for (let i = 0; i < RUNS && outs.size < 2; i++) outs.add(spawnSync(NODE, [file], { encoding: 'utf8' }).stdout.replace(/\n/g, ''));
  if (outs.size !== 1) { fs.unlinkSync(file); continue; }
  key.answers[id] = [...outs][0];
  md += `## ${id} (${p.ctxName}, ${p.ext === 'mjs' ? 'ES module' : 'CommonJS'})\n\n\`\`\`js\n${p.src}\`\`\`\n\n`;
  made++;
}
fs.writeFileSync(path.join(OUT, 'questions.md'), md);
fs.writeFileSync(path.join(OUT, 'key.json'), JSON.stringify(key, null, 2));
console.log(`kept ${made} stable programs out of ${tried} generated -> ${OUT}/questions.md (answers in key.json)`);
