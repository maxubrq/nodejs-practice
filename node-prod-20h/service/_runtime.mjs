// Phần đo đạc dùng chung cho naive.mjs, mine.mjs và bản fixed. KHÔNG chứa lời giải.
// - Gửi số đo về harness qua IPC mỗi 100 ms: rss, heapUsed, arrayBuffers, ELU, event loop delay max.
// - Nhận {cmd:'gc'} để harness đo heap sau GC (cần --expose-gc).
// Chạy tay không có harness cũng được: khi đó chỉ listen.
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

export const config = {
  port: Number(process.env.PORT || 3000),
  dbPort: Number(process.env.DB_PORT || 5433),
  upstream: `http://127.0.0.1:${process.env.UP_PORT || 5434}`,
  name: process.env.SVC_NAME || 'svc',
};

export function instrument(server) {
  const h = monitorEventLoopDelay({ resolution: 10 });
  h.enable();
  let eluPrev = performance.eventLoopUtilization();
  if (process.send) {
    const t = setInterval(() => {
      const m = process.memoryUsage();
      const elu = performance.eventLoopUtilization(eluPrev); eluPrev = performance.eventLoopUtilization();
      // Ở chế độ interval, mỗi mẫu = khoảng cách giữa 2 lần timer chạy, gồm cả resolution. Trừ đi để ra độ trễ.
      const lag = Math.max(0, h.max / 1e6 - 10);
      h.reset();
      process.send({ m: { rss: m.rss, heapUsed: m.heapUsed, arrayBuffers: m.arrayBuffers, elu: elu.utilization, lag } });
    }, 100);
    t.unref();
    process.on('message', (msg) => {
      if (msg?.cmd === 'gc' && globalThis.gc) { gc(); gc(); process.send({ gc: process.memoryUsage().heapUsed }); }
    });
  }
  server.listen(config.port, '127.0.0.1', () => process.send?.({ ready: true }));
  return server;
}
