// monitorEventLoopDelay: interval mode vs samplePerIteration (v24.19.0+).
// Phase 1: idle 1 s. Phase 2: five 100 ms sync blocks, 200 ms apart.
// Predict p50 and max (ms) of each mode in each phase.
const { monitorEventLoopDelay } = require('perf_hooks');
const ms = (ns) => (ns / 1e6).toFixed(1);
function make() {
  const a = monitorEventLoopDelay({ resolution: 10 }); a.enable();
  let b = null;
  try { b = monitorEventLoopDelay({ samplePerIteration: true }); b.enable(); } catch (e) { b = null; }
  return { a, b };
}
function report(tag, { a, b }) {
  a.disable(); b?.disable();
  console.log(`${tag} interval(res=10): p50 ${ms(a.percentile(50))} max ${ms(a.max)} | perIteration: ` +
    (b ? `p50 ${ms(b.percentile(50))} max ${ms(b.max)} count ${b.count}` : 'unsupported'));
}
const idle = make();
setTimeout(() => {
  report('idle   ', idle);
  const busy = make();
  let n = 0;
  const t = setInterval(() => {
    const end = performance.now() + 100; while (performance.now() < end);
    if (++n === 5) { clearInterval(t); setTimeout(() => report('blocked', busy), 50); }
  }, 200);
}, 1000);
