import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
  Promise.resolve().then(() => {
    log('B');
    process.nextTick(() => {
      log('C');
    });
    Promise.resolve().then(() => {
      log('D');
    });
  });
  setTimeout(() => {
    log('E');
  }, 0);
});
log('F');
