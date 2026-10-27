const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
(async () => {
  await null;
  log('A');
  process.nextTick(() => {
    log('B');
    setImmediate(() => {
      log('C');
    });
  });
})();
process.nextTick(() => {
  log('D');
  process.nextTick(() => {
    log('E');
  });
});
log('F');
