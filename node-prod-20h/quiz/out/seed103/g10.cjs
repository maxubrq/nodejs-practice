const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
Promise.resolve().then(() => {
  log('A');
});
queueMicrotask(() => {
  log('B');
  (async () => {
    await null;
    log('C');
    process.nextTick(() => {
      log('D');
    });
  })();
  process.nextTick(() => {
    log('E');
    log('F');
  });
});
