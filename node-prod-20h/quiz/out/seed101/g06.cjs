const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
(async () => {
  log('A');
  await Promise.resolve();
  (async () => {
    await null;
    log('B');
    Promise.resolve().then(() => {
      log('C');
    });
  })();
  log('D');
})();
setTimeout(() => {
  log('E');
}, 0);
setTimeout(() => {
  log('F');
}, 0);
