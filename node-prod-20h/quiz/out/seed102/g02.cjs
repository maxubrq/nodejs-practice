const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
(async () => {
  log('A');
  await Promise.resolve();
  log('B');
})();
setTimeout(() => {
  log('C');
  log('D');
  setTimeout(() => {
    log('E');
    Promise.resolve().then(() => {
      log('F');
    });
  }, 0);
}, 0);
