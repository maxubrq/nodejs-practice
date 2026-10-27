const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
  setImmediate(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
    Promise.resolve().then(() => {
      log('D');
    });
  });
});
Promise.resolve().then(() => {
  log('E');
  log('F');
  log('G');
});
