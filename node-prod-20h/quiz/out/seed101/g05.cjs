const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
fs.stat(__filename, () => {
  log('A');
  log('B');
  queueMicrotask(() => {
    log('C');
    Promise.resolve().then(() => {
      log('D');
    });
  });
});
log('E');
(async () => {
  await null;
  log('F');
})();
