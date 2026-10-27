// Stream: highWaterMark 16 bytes, 5-byte writes. Which write() calls return false? Are any bytes lost?
const { Writable } = require('stream');
let got = 0;
const w = new Writable({ highWaterMark: 16, write(c, e, cb) { got += c.length; setImmediate(cb); } });
const r = [];
for (let i = 0; i < 6; i++) r.push(w.write('abcde'));
w.end(() => console.log(r.join(','), 'received', got));
