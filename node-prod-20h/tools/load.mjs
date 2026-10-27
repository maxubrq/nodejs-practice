// Bộ tạo tải tối giản, không phụ thuộc. Đếm mọi kết cục của request, không chỉ status code.
// Kết cục: status (đọc hết body) | serverClose (server cắt giữa chừng) | timeout (client tự bỏ) | clientAbort | err:<code>
import http from 'node:http';

const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : null);

export function summarize(results, extra = {}) {
  const lat = results.filter((r) => r.outcome !== 'clientAbort').map((r) => r.ms).sort((a, b) => a - b);
  const outcomes = {};
  for (const r of results) {
    const k = r.outcome === 'status' ? String(r.status) : r.outcome === 'err' ? `err:${r.code}` : r.outcome;
    outcomes[k] = (outcomes[k] || 0) + 1;
  }
  return {
    n: results.length, outcomes,
    p50: pct(lat, 50) && +pct(lat, 50).toFixed(1), p99: pct(lat, 99) && +pct(lat, 99).toFixed(1),
    max: lat.length ? +lat[lat.length - 1].toFixed(1) : null, ...extra,
  };
}

export function request(agent, { url, method = 'GET', body, headers = {}, timeoutMs = 10_000, abortAfterMs }) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let settled = false;
    const done = (r) => { if (settled) return; settled = true; clearTimeout(timer); resolve({ ...r, ms: performance.now() - t0 }); };
    const req = http.request(url, { method, agent, headers: body ? { 'content-length': body.length, ...headers } : headers });
    const timer = setTimeout(() => { done({ outcome: 'timeout' }); req.destroy(); }, timeoutMs);
    req.on('response', (res) => {
      if (abortAfterMs != null) setTimeout(() => { done({ outcome: 'clientAbort', status: res.statusCode }); req.destroy(); }, abortAfterMs);
      res.on('data', () => {});
      res.on('end', () => done({ outcome: 'status', status: res.statusCode, lb: res.headers['x-lb-error'] }));
      res.on('aborted', () => done({ outcome: 'serverClose', status: res.statusCode }));
      res.on('error', () => done({ outcome: 'serverClose', status: res.statusCode }));
    });
    req.on('error', (e) => done({ outcome: 'err', code: e.code || e.message }));
    if (body) {
      // Ghi theo lát 1 MB để không giữ cả payload trong một lần write.
      let off = 0;
      const pump = () => {
        while (off < body.length) {
          const ok = req.write(body.subarray(off, off + (1 << 20))); off += 1 << 20;
          if (!ok) return req.once('drain', pump);
        }
        req.end();
      };
      req.on('error', () => {});
      pump();
    } else req.end();
  });
}

// conns worker song song; dừng khi hết durationMs hoặc đủ `requests`.
export async function load({ conns = 10, durationMs, requests, ...opt }) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: conns });
  const results = [];
  const end = durationMs ? performance.now() + durationMs : Infinity;
  let issued = 0;
  await Promise.all(Array.from({ length: conns }, async () => {
    while (performance.now() < end && (requests == null || issued < requests)) {
      issued++;
      results.push(await request(agent, opt));
    }
  }));
  agent.destroy();
  return results;
}
