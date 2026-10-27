import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
});
log('B');
process.nextTick(() => {
  log('C');
});
queueMicrotask(() => {
  log('D');
  setTimeout(() => {
    log('E');
    log('F');
    setImmediate(() => {
      log('G');
    });
  }, 0);
});
