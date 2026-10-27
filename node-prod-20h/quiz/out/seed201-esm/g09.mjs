import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
Promise.resolve().then(() => {
  log('A');
  process.nextTick(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
    queueMicrotask(() => {
      log('D');
    });
  });
  process.nextTick(() => {
    log('E');
    setImmediate(() => {
      log('F');
    });
  });
});
