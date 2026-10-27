// Allocate off-heap memory (Buffers) in 20 MB steps; print heap vs rss.
const v8 = require('v8');
console.log('constrainedMemory MB', (process.constrainedMemory() / 2 ** 20).toFixed(0),
  'heap_size_limit MB', (v8.getHeapStatistics().heap_size_limit / 2 ** 20).toFixed(0));
const keep = [];
for (let i = 1; i <= 25; i++) {
  keep.push(Buffer.alloc(20 * 2 ** 20, 1));
  const m = process.memoryUsage();
  console.log(`step ${i}: rss ${(m.rss / 2 ** 20).toFixed(0)} MB | heapUsed ${(m.heapUsed / 2 ** 20).toFixed(1)} MB | arrayBuffers ${(m.arrayBuffers / 2 ** 20).toFixed(0)} MB`);
}
