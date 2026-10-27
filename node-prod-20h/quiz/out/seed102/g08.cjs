const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
(async () => {
  log('A');
  await Promise.resolve();
  log('B');
})();
process.nextTick(() => {
  log('C');
  setTimeout(() => {
    log('D');
    Promise.resolve().then(() => {
      log('E');
    });
  }, 0);
});
log('F');
