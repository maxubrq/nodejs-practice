const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
(async () => {
  await null;
  log('A');
  log('B');
})();
(async () => {
  log('C');
  await Promise.resolve();
  (async () => {
    log('D');
    await Promise.resolve();
    log('E');
    log('F');
  })();
  setTimeout(() => {
    log('G');
    log('H');
    log('I');
  }, 0);
  log('J');
})();
