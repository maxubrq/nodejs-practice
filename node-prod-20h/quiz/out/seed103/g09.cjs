const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
setTimeout(() => {
  log('A');
}, 0);
log('B');
(async () => {
  await null;
  log('C');
  queueMicrotask(() => {
    log('D');
    log('E');
    Promise.resolve().then(() => {
      log('F');
    });
  });
})();
