const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
fs.stat(__filename, () => {
  log('A');
  process.nextTick(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
    process.nextTick(() => {
      log('D');
    });
  });
});
queueMicrotask(() => {
  log('E');
});
Promise.resolve().then(() => {
  log('F');
  fs.stat(__filename, () => {
    log('G');
    setImmediate(() => {
      log('H');
    });
    queueMicrotask(() => {
      log('I');
    });
  });
});
