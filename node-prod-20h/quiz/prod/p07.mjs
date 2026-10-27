// Q: highWaterMark 16 byte, mỗi lần ghi 5 byte, sink chậm. write() trả false ở lần thứ mấy? Sink nhận bao nhiêu byte?
import { Writable } from 'node:stream';
let got = 0;
const w = new Writable({ highWaterMark: 16, write(c, e, cb) { got += c.length; setTimeout(cb, 5); } });
const rets = [];
for (let i = 0; i < 6; i++) rets.push(w.write('xxxxx'));
w.end(() => console.log(`firstFalse=${rets.indexOf(false) + 1} received=${got}`));
