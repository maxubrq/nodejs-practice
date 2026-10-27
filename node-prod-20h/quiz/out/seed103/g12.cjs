const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
fs.stat(__filename, () => {
  log('A');
  setImmediate(() => {
    log('B');
    Promise.resolve().then(() => {
      log('C');
    });
    queueMicrotask(() => {
      log('D');
    });
  });
});
(async () => {
  await null;
  log('E');
})();
process.nextTick(() => {
  log('F');
});
