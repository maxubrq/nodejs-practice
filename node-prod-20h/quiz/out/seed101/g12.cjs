const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
setTimeout(() => {
  log('A');
  process.nextTick(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
  });
  queueMicrotask(() => {
    log('D');
    setTimeout(() => {
      log('E');
    }, 0);
    setTimeout(() => {
      log('F');
    }, 0);
  });
}, 0);
