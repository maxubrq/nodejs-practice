// Q: Thoát sớm khỏi for await bằng break. Stream nguồn có bị hủy không?
import { Readable } from 'node:stream';
const r = Readable.from(['a', 'b', 'c']);
for await (const x of r) { if (x === 'a') break; }
console.log(`destroyed=${r.destroyed}`);
