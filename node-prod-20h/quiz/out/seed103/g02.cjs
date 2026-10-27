const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
setImmediate(() => {
  log('A');
  setImmediate(() => {
    log('B');
    process.nextTick(() => {
      log('C');
    });
  });
});
process.nextTick(() => {
  log('D');
  log('E');
  (async () => {
    await null;
    log('F');
    Promise.resolve().then(() => {
      log('G');
    });
  })();
});
