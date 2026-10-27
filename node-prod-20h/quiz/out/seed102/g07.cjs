const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
});
Promise.resolve().then(() => {
  log('B');
});
(async () => {
  await null;
  log('C');
  Promise.resolve().then(() => {
    log('D');
  });
  setImmediate(() => {
    log('E');
    queueMicrotask(() => {
      log('F');
    });
  });
})();
