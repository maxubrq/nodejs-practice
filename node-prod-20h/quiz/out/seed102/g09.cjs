const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
log('A');
setImmediate(() => {
  log('B');
  log('C');
  Promise.resolve().then(() => {
    log('D');
    setImmediate(() => {
      log('E');
    });
  });
});
process.nextTick(() => {
  log('F');
});
