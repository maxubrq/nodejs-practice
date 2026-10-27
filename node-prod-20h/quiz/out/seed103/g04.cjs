const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
process.nextTick(() => {
  log('A');
});
setTimeout(() => {
  log('B');
  (async () => {
    await null;
    log('C');
  })();
  queueMicrotask(() => {
    log('D');
    Promise.resolve().then(() => {
      log('E');
    });
  });
}, 0);
setTimeout(() => {
  log('F');
}, 0);
