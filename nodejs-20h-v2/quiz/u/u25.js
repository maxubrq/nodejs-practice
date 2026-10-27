// postMessage with transferList: sender's byteLength after the call?
const { MessageChannel } = require('worker_threads');
const { port1, port2 } = new MessageChannel();
const buf = new ArrayBuffer(1024);
port1.postMessage(buf, [buf]);
console.log('sender byteLength', buf.byteLength);
port2.once('message', (m) => { console.log('receiver byteLength', m.byteLength); port1.close(); });
