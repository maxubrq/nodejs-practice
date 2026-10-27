const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
log('A');
Promise.resolve().then(() => {
  log('B');
  process.nextTick(() => {
    log('C');
    queueMicrotask(() => {
      log('D');
    });
  });
  log('E');
});
setTimeout(() => {
  log('F');
  process.nextTick(() => {
    log('G');
    Promise.resolve().then(() => {
      log('H');
    });
  });
  (async () => {
    log('I');
    await Promise.resolve();
    setTimeout(() => {
      log('J');
    }, 0);
    log('K');
  })();
}, 0);
