const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
process.nextTick(() => {
  log('A');
  (async () => {
    log('B');
    await Promise.resolve();
    log('C');
  })();
});
Promise.resolve().then(() => {
  log('D');
  (async () => {
    log('E');
    await Promise.resolve();
    Promise.resolve().then(() => {
      log('F');
    });
    log('G');
  })();
});
