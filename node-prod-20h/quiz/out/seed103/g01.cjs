const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
log('A');
log('B');
Promise.resolve().then(() => {
  log('C');
  queueMicrotask(() => {
    log('D');
  });
});
queueMicrotask(() => {
  log('E');
  (async () => {
    await null;
    log('F');
    setImmediate(() => {
      log('G');
    });
  })();
});
