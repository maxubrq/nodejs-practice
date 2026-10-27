// Q: Gắn .catch sau hai lần await null. Thoát mã nào?
import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, ['-e', `
  (async () => {
    const p = Promise.reject(new Error('boom'));
    await null; await null;
    p.catch(() => console.log('caught'));
  })();
`], { encoding: 'utf8' });
console.log(`stdout=${r.stdout.trim() || '(trống)'} exit=${r.status}`);
