const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
});
setImmediate(() => {
  log('B');
  log('C');
});
(async () => {
  log('D');
  await Promise.resolve();
  queueMicrotask(() => {
    log('E');
  });
  log('F');
})();
