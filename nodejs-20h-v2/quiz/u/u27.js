// Run with --max-old-space-size=16. Allocate 200 MB of Buffers. Crash or not? heapUsed vs arrayBuffers?
const keep = []; for (let i = 0; i < 10; i++) keep.push(Buffer.alloc(20 * 2 ** 20));
const m = process.memoryUsage();
console.log('alive; heapUsed<16MB:', m.heapUsed < 16 * 2 ** 20, 'arrayBuffers>=200MB:', m.arrayBuffers >= 200 * 2 ** 20);
