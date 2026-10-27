const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
(async () => {
  await null;
  log('A');
  log('B');
  log('C');
})();
queueMicrotask(() => {
  log('D');
});
process.nextTick(() => {
  log('E');
  setTimeout(() => {
    log('F');
    process.nextTick(() => {
      log('G');
    });
  }, 0);
});
