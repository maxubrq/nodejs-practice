const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
process.nextTick(() => {
  log('A');
  Promise.resolve().then(() => {
    log('B');
  });
  setImmediate(() => {
    log('C');
  });
});
setImmediate(() => {
  log('D');
});
queueMicrotask(() => {
  log('E');
  queueMicrotask(() => {
    log('F');
    setImmediate(() => {
      log('G');
    });
    queueMicrotask(() => {
      log('H');
    });
  });
  log('I');
});
