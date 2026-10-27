const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
  queueMicrotask(() => {
    log('B');
    Promise.resolve().then(() => {
      log('C');
    });
    log('D');
  });
  log('E');
});
queueMicrotask(() => {
  log('F');
});
