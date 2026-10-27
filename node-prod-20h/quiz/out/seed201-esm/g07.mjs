import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
(async () => {
  log('A');
  await Promise.resolve();
  Promise.resolve().then(() => {
    log('B');
    setImmediate(() => {
      log('C');
    });
    Promise.resolve().then(() => {
      log('D');
    });
  });
  (async () => {
    await null;
    log('E');
  })();
  log('F');
})();
