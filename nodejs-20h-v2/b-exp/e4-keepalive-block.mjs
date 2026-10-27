// Server (child process) keepAliveTimeout=1000 ms -> socket times out at 1000 + keepAliveTimeoutBuffer (1000) = 2000 ms.
// Client is a raw TCP socket that ignores the Keep-Alive hint (like a cloud LB).
// t=0: request 1. t=300: server blocks its event loop for BLOCK ms. t=600: request 2 on the same connection.
// Predict request 2's result for BLOCK = 1000 and 3000, with the block in the timers phase vs in an I/O callback.
// Run: node e4-keepalive-block.mjs <BLOCK> <timer|io>
// (Note: Node's own http.Agent would not even reuse this socket: it expires sockets at hint - agentKeepAliveTimeoutBuffer.)
import http from 'node:http';
import net from 'node:net';
import { fork } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

if (process.argv[2] === 'server') {
  const BLOCK = +process.argv[3]; const WHERE = process.argv[4];
  const server = http.createServer((req, res) => {
    const block = () => { const end = performance.now() + BLOCK; while (performance.now() < end); };
    if (req.url === '/block') { block(); return res.end('blocked'); }   // block inside the poll phase (I/O callback)
    res.end('ok');
    if (req.url === '/1' && WHERE === 'timer') setTimeout(block, 300);  // block inside the timers phase
  });
  server.keepAliveTimeout = 1000;
  server.listen(0, () => process.send({ port: server.address().port, buffer: server.keepAliveTimeoutBuffer }));
} else {
  const BLOCK = +process.argv[2] || 3000; const WHERE = process.argv[3] || 'timer';
  const child = fork(new URL(import.meta.url).pathname, ['server', String(BLOCK), WHERE]);
  const { port, buffer } = await new Promise((r) => child.once('message', r));
  const sock = net.connect(port, '127.0.0.1');
  sock.on('error', () => {});
  let pending = null;
  sock.on('data', (d) => { const s = String(d); if (pending && s.includes('\r\n\r\n')) { pending(`HTTP ${s.split(' ')[1]}`); pending = null; } });
  sock.on('close', () => { if (pending) { pending('connection closed with no response'); pending = null; } });
  const send = (p) => new Promise((res) => { const t = performance.now(); pending = (r) => res(`${r} after ${Math.round(performance.now() - t)}ms`); sock.write(`GET ${p} HTTP/1.1\r\nhost: x\r\n\r\n`); });
  console.log('req1:', await send('/1'));
  if (WHERE === 'io') setTimeout(() => http.get({ port, path: '/block', agent: false }).on('error', () => {}), 300);
  await sleep(600);
  console.log(`req2 (block ${BLOCK}ms in ${WHERE} phase, socket timeout ${1000 + buffer}ms):`, await send('/2'));
  sock.destroy(); child.kill();
}
