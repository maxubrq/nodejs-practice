// Run with UV_THREADPOOL_SIZE given in the question. pbkdf2 (~200 ms) starts first, then fs.stat.
// Which callback prints first?
const crypto = require('crypto'), fs = require('fs');
crypto.pbkdf2('p', 's', 200000, 32, 'sha256', () => console.log('pbkdf2'));
fs.stat(__filename, () => console.log('stat'));
