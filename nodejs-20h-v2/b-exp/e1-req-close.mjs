// When does req 'close' fire? Handler does 500 ms of async work.
// Case A: client waits. Case B: client aborts at 100 ms.
// Predict for each case: time of req 'close', res 'close', and res.writableFinished at res 'close'.
import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

const log = [];
const server = http.createServer(async (req, res) => {
  const t0 = performance.now();
  const at = () => Math.round(performance.now() - t0);
  req.on('close', () => log.push(`req close @${at()}ms`));
  res.on('close', () => log.push(`res close @${at()}ms writableFinished=${res.writableFinished}`));
  await sleep(500);
  res.end('done');
  log.push(`handler end() @${at()}ms destroyed=${res.destroyed}`);
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

for (const abortAt of [null, 100]) {
  log.length = 0;
  await new Promise((resolve) => {
    const r = http.get(url, { agent: false }, (rs) => { rs.resume(); rs.on('end', resolve); });
    r.on('error', () => {});
    if (abortAt) setTimeout(() => { r.destroy(); resolve(); }, abortAt);
  });
  await sleep(700);
  console.log(abortAt ? 'B (client aborts @100ms):' : 'A (client waits):', log.join(' | '));
}
server.close();
