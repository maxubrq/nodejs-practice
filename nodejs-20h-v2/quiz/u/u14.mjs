// Source errors after 3 chunks. Is dest destroyed with .pipe()? with pipeline()?
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const src = () => { let i = 0; return new Readable({ read() { if (++i <= 3) this.push('x'); else this.destroy(new Error('src')); } }); };
const dst = () => new Writable({ write(c, e, cb) { cb(); } });
const a = src(), b = dst(); a.on('error', () => {}); a.pipe(b);
await new Promise((r) => setTimeout(r, 50));
const c = dst(); await pipeline(src(), c).catch(() => {});
console.log('pipe dest destroyed:', b.destroyed, '| pipeline dest destroyed:', c.destroyed);
