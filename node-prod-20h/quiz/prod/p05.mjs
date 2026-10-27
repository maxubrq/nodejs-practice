// Q: Nguồn lỗi giữa chừng. Với .pipe(), đích có bị hủy không?
import { Readable, Writable } from 'node:stream';
const src = new Readable({ read() {} });
const dst = new Writable({ write(c, e, cb) { cb(); } });
src.on('error', () => {});
src.pipe(dst);
src.push('a');
setTimeout(() => src.destroy(new Error('boom')), 10);
setTimeout(() => console.log(`dst.destroyed=${dst.destroyed}`), 50);
