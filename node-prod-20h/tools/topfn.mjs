// Đọc file .cpuprofile thô (từ --cpu-prof hoặc DevTools) và in các hàm tốn self time nhiều nhất.
// Không qua diễn giải của ai: tính trực tiếp từ samples × timeDeltas.
//   node tools/topfn.mjs <file.cpuprofile> [N=10]
import fs from 'node:fs';
const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const N = Number(process.argv[3] || 10);
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const self = new Map();
p.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + (p.timeDeltas[i] || 0)));
const agg = new Map();
let total = 0;
for (const [id, us] of self) {
  const cf = byId.get(id).callFrame;
  const key = `${cf.functionName || '(anonymous)'}  ${cf.url ? cf.url.split('/').slice(-2).join('/') + ':' + (cf.lineNumber + 1) : ''}`;
  agg.set(key, (agg.get(key) || 0) + us); total += us;
}
console.log(`tổng ${(total / 1000).toFixed(0)} ms mẫu`);
for (const [k, us] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, N)) console.log(`${(us / 1000).toFixed(1).padStart(9)} ms ${((100 * us) / total).toFixed(1).padStart(5)}%  ${k}`);
