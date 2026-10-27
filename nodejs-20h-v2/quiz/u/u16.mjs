// Handler awaits 300 ms. Client aborts at 50 ms. When res 'close' fires, what is res.writableFinished?
// After the handler calls res.end() on the destroyed response, does anything throw?
import http from 'node:http';
const out = [];
const s = http.createServer(async (req, res) => {
  res.on('close', () => out.push('res close finished=' + res.writableFinished));
  await new Promise((r) => setTimeout(r, 300));
  try { res.end('x'); out.push('end ok destroyed=' + res.destroyed); } catch (e) { out.push('end threw ' + e.code); }
});
s.listen(0, () => {
  const r = http.get({ port: s.address().port, agent: false }); r.on('error', () => {});
  setTimeout(() => r.destroy(), 50);
  setTimeout(() => { console.log(out.join(' | ')); s.close(); }, 500);
});
