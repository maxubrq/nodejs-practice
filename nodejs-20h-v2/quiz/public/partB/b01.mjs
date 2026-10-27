import http from 'node:http';
import { fork } from 'node:child_process';
if (process.argv[2] === 'srv') {
  http.createServer(async (req, res) => { if (req.url === '/bad') throw new Error('bug'); res.end('ok'); })
    .listen(0, function () { process.send(this.address().port); });
} else {
  const c = fork(new URL(import.meta.url).pathname, ['srv'], { stdio: 'ignore' });
  const port = await new Promise((r) => c.once('message', r));
  const res = await new Promise((r) => { const q = http.get({ port, path: '/bad', agent: false }, (x) => r('status ' + x.statusCode)); q.on('error', (e) => r(e.code || e.message)); });
  await new Promise((r) => setTimeout(r, 200));
  console.log('client got:', res, '| server exitCode:', c.exitCode);
  c.kill();
}
