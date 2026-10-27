import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
log('A');
setImmediate(() => {
  log('B');
  process.nextTick(() => {
    log('C');
    Promise.resolve().then(() => {
      log('D');
    });
    setImmediate(() => {
      log('E');
    });
  });
});
queueMicrotask(() => {
  log('F');
  process.nextTick(() => {
    log('G');
  });
});
