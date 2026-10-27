import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
  fs.stat(__filename, () => {
    log('B');
    Promise.resolve().then(() => {
      log('C');
    });
    queueMicrotask(() => {
      log('D');
    });
  });
});
(async () => {
  await null;
  log('E');
})();
fs.stat(__filename, () => {
  log('F');
  fs.stat(__filename, () => {
    log('G');
    log('H');
    setImmediate(() => {
      log('I');
    });
  });
});
