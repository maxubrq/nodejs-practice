const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
setImmediate(() => {
  log('A');
  setImmediate(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
  });
  process.nextTick(() => {
    log('D');
  });
});
queueMicrotask(() => {
  log('E');
  queueMicrotask(() => {
    log('F');
  });
  queueMicrotask(() => {
    log('G');
  });
});
