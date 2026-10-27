import { Readable } from 'node:stream';
async function* gen() { try { for (let i = 0; ; i++) yield i; } finally { console.log('generator finally ran'); } }
const r = Readable.from(gen());
for await (const x of r) { if (x === 3) break; }
console.log('after loop, destroyed:', r.destroyed);
