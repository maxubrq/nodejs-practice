const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
queueMicrotask(() => {
  log('A');
  log('B');
});
(async () => {
  await null;
  log('C');
  Promise.resolve().then(() => {
    log('D');
    process.nextTick(() => {
      log('E');
    });
  });
})();
Promise.resolve().then(() => {
  log('F');
  setImmediate(() => {
    log('G');
  });
  Promise.resolve().then(() => {
    log('H');
    log('I');
  });
});
