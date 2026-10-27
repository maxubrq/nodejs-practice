// Chấm một file results-faults-*.jsonl theo faults/CRITERIA.md.
//   node faults/check.mjs results-faults-mine-v24.jsonl
const fs = await import('node:fs');
const rows = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const o = (r, k) => r.load?.outcomes?.[k] || 0;
const probeOk = (r) => (r.probe ? r.probe.errors === 0 : true);
const alive = (r) => r.serviceExit === 'alive';
const C = {
  F1: (r) => [['p99 ≤ 500 ms', r.load.p99 <= 500], ['0 timeout', o(r, 'timeout') === 0], ['0 query treo ở DB', r.dbInflightAfter === 0]],
  F2: (r) => [['0 timeout', o(r, 'timeout') === 0], ['p99 ≤ 50 ms', r.load.p99 <= 50]],
  F3: (r) => [['0 upstream còn mở', r.upstreamOpenAfter === 0]],
  F4: (r) => [['server đóng 20/20', r.closedByServer === 20], ['đóng ≤ 2500 ms', r.closeMaxMs != null && r.closeMaxMs <= 2500], ['0 upstream còn mở', r.upstreamOpenAfter === 0]],
  F5: (r) => [['service sống, 0 OOM kill', alive(r) && r.oomKill === 0], ['RSS max ≤ 100 MB', r.rssMaxMB <= 100], ['probe 0 lỗi', probeOk(r)]],
  F6: (r) => [['request ≤ 50 ms', r.load.max <= 50], ['probe 0 lỗi', probeOk(r)]],
  F7: (r) => [['0 non-2xx', r.non2xx === 0], ['backend thoát mã 0', /^code 0/.test(r.b1Exit)]],
  F8: (r) => [['0 lỗi 502', o(r, '502') === 0]],
  F9: (r) => [['service sống', alive(r)], ['0 lỗi', r.load.n === o(r, '200')]],
  F10: (r) => [['/config p99 ≤ 50 ms', r.load.p99 <= 50]],
  F11: (r) => [['heap tăng ≤ 2 MB sau GC', r.heapGrowthAfterGcMB <= 2], ['không MaxListenersExceededWarning', !r.maxListenersWarning]],
  F12: (r) => [['thoát ≤ 3 s sau SIGTERM khi là PID 1', /^thoát sau (\d+)/.test(r.afterSigterm) && Number(r.afterSigterm.match(/\d+/)[0]) <= 3000]],
};
let pass = 0;
for (const r of rows) {
  if (r.error) { console.log(`${r.fault.padEnd(4)} LỖI HARNESS: ${r.error}`); continue; }
  const checks = (C[r.fault]?.(r) ?? []);
  if (r.probe && !['F5', 'F6'].includes(r.fault)) checks.push(['probe 0 lỗi', probeOk(r)]);
  const ok = checks.every(([, v]) => v);
  if (ok) pass++;
  console.log(`${r.fault.padEnd(4)} ${ok ? 'ĐẠT ' : 'CHƯA'}  ${checks.map(([n, v]) => `${v ? '✓' : '✗'} ${n}`).join('   ')}`);
}
console.log(`\n${pass}/${rows.length} kịch bản đạt (${rows[0]?.impl}, Node ${rows[0]?.node})`);
