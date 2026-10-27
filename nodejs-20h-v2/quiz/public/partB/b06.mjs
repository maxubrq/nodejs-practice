// undici Agent with 1 connection; three sequential fetches; bodies of the first two are never read.
import { createRequire } from 'node:module';
const require = createRequire(process.env.UNDICI_DIR ? process.env.UNDICI_DIR + '/' : import.meta.url);
const { Agent } = require('undici');
import http from 'node:http';
const s = http.createServer((q, r) => r.end('x'.repeat(1e6)));
await new Promise((r) => s.listen(0, r));
const d = new Agent({ connections: 1 });
const out = [];
const t = setTimeout(() => { console.log(`${out.length} of 3 fetches completed within 2 s`); process.exit(0); }, 2000);
for (let i = 1; i <= 3; i++) { await fetch(`http://127.0.0.1:${s.address().port}/`, { dispatcher: d }); out.push(`fetch${i} ok`); }
clearTimeout(t); console.log('3 of 3 fetches completed'); process.exit(0);
