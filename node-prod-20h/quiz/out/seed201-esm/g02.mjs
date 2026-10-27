import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
(async () => {
  log('A');
  await Promise.resolve();
  log('B');
})();
log('C');
queueMicrotask(() => {
  log('D');
});
setTimeout(() => {
  log('E');
  queueMicrotask(() => {
    log('F');
    process.nextTick(() => {
      log('G');
    });
    setImmediate(() => {
      log('H');
    });
  });
}, 0);
