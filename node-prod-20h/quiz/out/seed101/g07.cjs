const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
  setTimeout(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
  }, 0);
  setTimeout(() => {
    log('D');
  }, 0);
});
Promise.resolve().then(() => {
  log('E');
  log('F');
});
