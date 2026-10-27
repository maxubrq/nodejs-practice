import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
  queueMicrotask(() => {
    log('B');
    log('C');
    log('D');
  });
});
queueMicrotask(() => {
  log('E');
  setTimeout(() => {
    log('F');
    setImmediate(() => {
      log('G');
    });
    setTimeout(() => {
      log('H');
    }, 0);
  }, 0);
});
