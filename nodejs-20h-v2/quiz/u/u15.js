// Default highWaterMark values on this Node version.
const { Readable, Writable, Transform } = require('stream');
const fs = require('fs');
console.log(new Readable().readableHighWaterMark, new Writable().writableHighWaterMark,
  new Transform({ objectMode: true }).readableHighWaterMark, fs.createReadStream(__filename).readableHighWaterMark);
