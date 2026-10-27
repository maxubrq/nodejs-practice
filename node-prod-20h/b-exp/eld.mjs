// monitorEventLoopDelay đo cái gì? So hai chế độ khi rảnh và khi bị chặn 5 lần × 100 ms. Kèm ELU.
// Dùng: node b-exp/eld.mjs
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ms = (ns) => +(ns / 1e6).toFixed(1);
const block = (t) => { const s = performance.now(); while (performance.now() - s < t) {} };

async function measure(opts, busy) {
  const h = monitorEventLoopDelay(opts);
  const elu0 = performance.eventLoopUtilization();
  h.enable();
  for (let i = 0; i < 5; i++) { await sleep(200); if (busy) block(100); }
  await sleep(200);
  h.disable();
  const elu = performance.eventLoopUtilization(elu0).utilization;
  return { opts: JSON.stringify(opts), busy, p50: ms(h.percentile(50)), p99: ms(h.percentile(99)), max: ms(h.max), n: h.count, elu: +elu.toFixed(2) };
}

const rows = [];
for (const res of [10, 20]) for (const busy of [false, true]) rows.push(await measure({ resolution: res }, busy));
let perIter = true;
for (const busy of [false, true]) {
  try { rows.push(await measure({ samplePerIteration: true }, busy)); } catch { perIter = false; }
}
console.log(JSON.stringify({ node: process.versions.node, samplePerIterationSupported: perIter }));
console.table(rows);
