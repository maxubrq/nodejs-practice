// Chấm CSV xuất từ Google Forms và kiểm khẳng định "phân vị ≥ 95".
//   node quiz/public/grade-responses.mjs responses.csv partA-key.json partB-key.json --me you@example.com
//   node quiz/public/grade-responses.mjs --selftest
// Cột bắt buộc trong Form (tiêu đề bắt đầu bằng mã): "Email", "S1 ..." (có viết Node production? Có/Không),
// "S2 ..." (số năm), "S3 ..." (bản Node), "T1 ..." (giờ bắt đầu HH:MM), "T2 ..." (giờ nộp HH:MM),
// "G01 ..." … "G12 ..." (phần A: chuỗi chữ cái), "B01 ..." … (phần B: chữ cái đáp án).
// Loại: S1 ≠ "Có", thời gian làm > 30 phút, thiếu T1/T2.
// Thống kê: k = số người bạn hơn HẲN (hòa không tính là hơn). H0: phân vị thật ≤ 0,95.
//   p-value = P(Binomial(n, 0,95) ≥ k). Cận dưới Clopper–Pearson một phía 95% cho xác suất bạn hơn một người ngẫu nhiên.
import fs from 'node:fs';

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// log P(Bin(n,p) = i)
const lgamma = (z) => { // Lanczos
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};
const lpmf = (n, p, i) => lgamma(n + 1) - lgamma(i + 1) - lgamma(n - i + 1) + (i ? i * Math.log(p) : 0) + (n - i ? (n - i) * Math.log1p(-p) : 0);
export const upperTail = (n, p, k) => { let s = 0; for (let i = k; i <= n; i++) s += Math.exp(lpmf(n, p, i)); return Math.min(1, s); };
export function cpLower(n, k, alpha = 0.05) {
  if (k === 0) return 0;
  let lo = 0, hi = 1;
  for (let it = 0; it < 100; it++) { const m = (lo + hi) / 2; if (upperTail(n, m, k) < alpha) lo = m; else hi = m; }
  return lo;
}
export function verdict(n, k) {
  const p = upperTail(n, 0.95, k), lb = cpLower(n, k);
  return { n, k, pValue: +p.toFixed(4), lowerBound95: +(lb * 100).toFixed(1), pass: p < 0.05 };
}

if (process.argv[2] === '--selftest') {
  for (const [n, k] of [[59, 59], [58, 58], [70, 70], [60, 56], [100, 99]]) console.log(JSON.stringify(verdict(n, k)));
  process.exit(0);
}

const [csvPath, keyA, keyB] = process.argv.slice(2);
const me = process.argv[process.argv.indexOf('--me') + 1]?.toLowerCase();
const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
const head = rows[0].map((h) => h.trim());
const col = (code) => head.findIndex((h) => h === code || h.startsWith(code + ' ') || h.toLowerCase() === code.toLowerCase());
const A = JSON.parse(fs.readFileSync(keyA)).answers, B = JSON.parse(fs.readFileSync(keyB)).answers;
const items = [...Object.entries(A).map(([k, v]) => [k.toUpperCase(), String(v)]), ...Object.entries(B).map(([k, v]) => [k.toUpperCase(), String(v)])];
const mins = (s) => { const m = /(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };

const people = [], excluded = {};
for (const r of rows.slice(1)) {
  const email = (r[col('Email')] || '').trim().toLowerCase();
  const t1 = mins(r[col('T1')]), t2 = mins(r[col('T2')]);
  const dur = t1 != null && t2 != null ? (t2 - t1 + 1440) % 1440 : null;
  const reason = !/^có|^yes/i.test((r[col('S1')] || '').trim()) ? 'không làm Node production' : dur == null ? 'thiếu giờ' : dur > 30 ? '>30 phút' : null;
  if (reason && email !== me) { excluded[reason] = (excluded[reason] || 0) + 1; continue; }
  let score = 0;
  for (const [code, ans] of items) {
    const c = col(code);
    if (c >= 0 && (r[c] || '').replace(/\s+/g, '').toUpperCase() === ans.replace(/\s+/g, '').toUpperCase()) score++;
  }
  people.push({ email, score, years: r[col('S2')], node: r[col('S3')], dur });
}
const mine = people.find((p) => p.email === me);
const others = people.filter((p) => p.email !== me);
const dist = {}; for (const p of others) dist[p.score] = (dist[p.score] || 0) + 1;
console.log(`số câu: ${items.length}; người hợp lệ (trừ bạn): ${others.length}; loại: ${JSON.stringify(excluded)}`);
console.log('phân phối điểm:', Object.entries(dist).sort((a, b) => a[0] - b[0]).map(([s, c]) => `${s}:${c}`).join(' '));
if (!mine) { console.log('không tìm thấy email của bạn'); process.exit(1); }
const k = others.filter((p) => p.score < mine.score).length;
const ties = others.filter((p) => p.score === mine.score).length;
const v = verdict(others.length, k);
console.log(`điểm của bạn: ${mine.score}/${items.length}; hơn hẳn ${k}, hòa ${ties}, thua ${others.length - k - ties}`);
console.log(`p-value (H0: phân vị ≤ 95%) = ${v.pValue}; cận dưới 95% = ${v.lowerBound95}% → ${v.pass ? 'ĐẠT' : 'CHƯA ĐẠT'}`);
if (others.length < 59) console.log(`cần thêm ít nhất ${59 - others.length} người hợp lệ (n ≥ 59 khi hơn tất cả).`);
