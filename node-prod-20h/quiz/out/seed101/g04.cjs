const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
setImmediate(() => {
  log('A');
});
queueMicrotask(() => {
  log('B');
  process.nextTick(() => {
    log('C');
    setImmediate(() => {
      log('D');
    });
  });
});
(async () => {
  await null;
  log('E');
  process.nextTick(() => {
    log('F');
  });
})();
