const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
process.nextTick(() => {
  log('A');
  (async () => {
    await null;
    log('B');
    Promise.resolve().then(() => {
      log('C');
    });
  })();
  (async () => {
    await null;
    log('D');
  })();
});
fs.stat(__filename, () => {
  log('E');
  process.nextTick(() => {
    log('F');
    setTimeout(() => {
      log('G');
    }, 0);
  });
  log('H');
});
