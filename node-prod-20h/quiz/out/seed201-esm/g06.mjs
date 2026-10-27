import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
log('A');
log('B');
(async () => {
  log('C');
  await Promise.resolve();
  fs.stat(__filename, () => {
    log('D');
    queueMicrotask(() => {
      log('E');
    });
  });
  log('F');
})();
