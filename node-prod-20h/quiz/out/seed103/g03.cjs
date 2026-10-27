const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
process.nextTick(() => {
  log('A');
  setImmediate(() => {
    log('B');
  });
  Promise.resolve().then(() => {
    log('C');
  });
});
(async () => {
  await null;
  log('D');
  (async () => {
    log('E');
    await Promise.resolve();
    process.nextTick(() => {
      log('F');
    });
    log('G');
  })();
  process.nextTick(() => {
    log('H');
    process.nextTick(() => {
      log('I');
    });
  });
})();
