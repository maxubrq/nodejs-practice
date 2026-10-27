// require() of an ES module without top-level await, then one with it.
const fs = require('fs'), path = require('path'), os = require('os');
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'q24-'));
fs.writeFileSync(path.join(d, 'a.mjs'), 'export const x = 1;');
fs.writeFileSync(path.join(d, 'b.mjs'), 'await null; export const y = 2;');
console.log('a:', require(path.join(d, 'a.mjs')).x);
try { require(path.join(d, 'b.mjs')); console.log('b: ok'); } catch (e) { console.log('b:', e.code); }
