const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
setImmediate(() => {
  log('A');
  (async () => {
    log('B');
    await Promise.resolve();
    setImmediate(() => {
      log('C');
    });
    setImmediate(() => {
      log('D');
    });
    log('E');
  })();
});
(async () => {
  await null;
  log('F');
  log('G');
  Promise.resolve().then(() => {
    log('H');
  });
})();
