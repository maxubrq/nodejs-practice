const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
process.nextTick(() => {
  log('A');
  (async () => {
    log('B');
    await Promise.resolve();
    setTimeout(() => {
      log('C');
    }, 0);
    process.nextTick(() => {
      log('D');
    });
    log('E');
  })();
  Promise.resolve().then(() => {
    log('F');
  });
});
