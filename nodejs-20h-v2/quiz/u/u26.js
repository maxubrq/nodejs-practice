// Idle process, monitorEventLoopDelay({ resolution: 20 }) for 1 s. Is p50 close to 0, to 10 ms, or to 20 ms?
const { monitorEventLoopDelay } = require('perf_hooks');
const h = monitorEventLoopDelay({ resolution: 20 }); h.enable();
setTimeout(() => {
  h.disable();
  const p50 = h.percentile(50) / 1e6;
  console.log('p50 close to', [0, 10, 20].reduce((a, b) => (Math.abs(b - p50) < Math.abs(a - p50) ? b : a)), 'ms');
}, 1000);
