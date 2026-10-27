// Minimal multiplexed DB client over one TCP connection.
// queueWhileDown=true mimics a pool that waits forever for a connection (no acquire timeout).
import net from 'node:net';

export function createDb({ port = 7001, queueWhileDown = true } = {}) {
  let sock = null, connected = false, seq = 0;
  const pending = new Map();
  const waiting = [];

  function connect() {
    sock = net.connect(port, '127.0.0.1');
    sock.setNoDelay(true);
    let buf = '';
    sock.on('connect', () => {
      connected = true;
      for (const w of waiting.splice(0)) sock.write(w);
    });
    sock.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        const sp = line.indexOf(' ');
        const id = line.slice(0, sp);
        const p = pending.get(id);
        if (p) { pending.delete(id); p.resolve(JSON.parse(line.slice(sp + 1))); }
      }
    });
    sock.on('error', () => {});
    sock.on('close', () => {
      connected = false;
      for (const [id, p] of pending) {
        if (p.sent) { pending.delete(id); p.reject(Object.assign(new Error('db connection lost'), { code: 'EDBLOST' })); }
      }
      setTimeout(connect, 100);
    });
  }
  connect();

  return {
    query(q, { signal } = {}) {
      return new Promise((resolve, reject) => {
        if (!connected && !queueWhileDown) return reject(Object.assign(new Error('db unavailable'), { code: 'EDBDOWN' }));
        if (signal?.aborted) return reject(signal.reason);
        const id = String(++seq);
        const line = id + ' ' + q + '\n';
        const p = { resolve, reject, sent: connected };
        pending.set(id, p);
        if (connected) sock.write(line); else waiting.push(line);
        signal?.addEventListener('abort', () => { if (pending.delete(id)) reject(signal.reason); }, { once: true });
      });
    },
    get pendingCount() { return pending.size; },
    get queued() { return waiting.length; },
  };
}
