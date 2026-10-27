const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
process.nextTick(() => {
  log('A');
});
queueMicrotask(() => {
  log('B');
});
queueMicrotask(() => {
  log('C');
  fs.stat(__filename, () => {
    log('D');
    log('E');
    process.nextTick(() => {
      log('F');
    });
  });
  (async () => {
    await null;
    log('G');
    process.nextTick(() => {
      log('H');
    });
  })();
});
