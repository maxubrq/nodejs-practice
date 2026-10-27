// Q: UV_THREADPOOL_SIZE=1, pbkdf2 đang giữ luồng duy nhất. Thứ tự xong của readFile, dns.lookup, fs.promises.readFile?
import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, ['-e', `
  const fs = require('fs'), dns = require('dns'), crypto = require('crypto');
  const file = process.argv[1];
  const o = [];
  crypto.pbkdf2('p', 's', 100000, 32, 'sha256', () => o.push('pbkdf2'));
  fs.readFile(file, () => o.push('readFile'));
  dns.lookup('localhost', () => o.push('lookup'));
  fs.promises.readFile(file).then(() => o.push('promises.readFile'));
  process.on('exit', () => console.log(o.join(' < ')));
`, import.meta.filename], { encoding: 'utf8', env: { ...process.env, UV_THREADPOOL_SIZE: '1' } });
console.log(r.stdout.trim());
