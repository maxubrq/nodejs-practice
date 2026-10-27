// Q: highWaterMark mặc định: Readable byte, Readable objectMode, fs.createReadStream?
import { Readable } from "node:stream";
import fs from "node:fs";
const f = fs.createReadStream(import.meta.filename);
console.log(
  `readable=${new Readable({ read() {} }).readableHighWaterMark} object=${new Readable({ objectMode: true, read() {} }).readableHighWaterMark} fs=${f.readableHighWaterMark}`,
);
f.destroy();
