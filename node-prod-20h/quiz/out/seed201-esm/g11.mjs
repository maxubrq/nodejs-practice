import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
process.nextTick(() => {
  log('A');
  (async () => {
    log('B');
    await Promise.resolve();
    log('C');
    setImmediate(() => {
      log('D');
    });
    log('E');
  })();
});
(async () => {
  log('F');
  await Promise.resolve();
  log('G');
})();
