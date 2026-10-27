import fs from 'node:fs';
const __filename = new URL(import.meta.url).pathname;
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
(async () => {
  await null;
  log('A');
})();
setImmediate(() => {
  log('B');
  fs.stat(__filename, () => {
    log('C');
  });
  Promise.resolve().then(() => {
    log('D');
    log('E');
  });
});
log('F');
