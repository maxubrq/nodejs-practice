// Inside an I/O callback: what runs first, the immediate scheduled from an immediate, or the timer?
require('fs').stat(__filename, () => {
  setImmediate(() => {
    console.log('imm-A');
    setImmediate(() => console.log('imm-B'));
    setTimeout(() => console.log('timeout'), 0);
  });
});
