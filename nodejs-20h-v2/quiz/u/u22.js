// UV_THREADPOOL_SIZE=1. pbkdf2 (~200 ms) starts first. Which finish before it: fs.readFile? fs.promises.readFile? dns.lookup('localhost')?
const crypto = require('crypto'), fs = require('fs'), dns = require('dns');
const order = [];
crypto.pbkdf2('p', 's', 200000, 32, 'sha256', () => { order.push('pbkdf2'); });
fs.readFile(__filename, () => order.push('readFile'));
fs.promises.readFile(__filename).then(() => order.push('promises.readFile'));
dns.lookup('localhost', () => order.push('lookup'));
setTimeout(() => console.log(order.join(' < ')), 1500);
