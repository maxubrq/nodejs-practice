const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
(async () => {
  log('A');
  await Promise.resolve();
  setTimeout(() => {
    log('B');
    setTimeout(() => {
      log('C');
    }, 0);
  }, 0);
  log('D');
})();
(async () => {
  log('E');
  await Promise.resolve();
  log('F');
})();
