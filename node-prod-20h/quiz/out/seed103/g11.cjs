const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
});
(async () => {
  await null;
  log('B');
  queueMicrotask(() => {
    log('C');
    log('D');
    log('E');
  });
  (async () => {
    log('F');
    await Promise.resolve();
    Promise.resolve().then(() => {
      log('G');
    });
    log('H');
  })();
})();
