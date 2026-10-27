const fs = require('fs');
const o = []; const log = (x) => o.push(x);
process.on('exit', () => console.log(o.join('')));
fs.stat(__filename, () => {
  log('A');
  Promise.resolve().then(() => {
    log('B');
    log('C');
  });
  setTimeout(() => {
    log('D');
    setImmediate(() => {
      log('E');
    });
    Promise.resolve().then(() => {
      log('F');
    });
  }, 0);
});
