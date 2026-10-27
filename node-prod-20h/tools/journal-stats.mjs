// Tỉ lệ đúng theo block và theo mức tự tin từ journal.csv (cột dung_sai: dung|sai).
//   node tools/journal-stats.mjs [journal.csv]
// Mức tự tin 5 phải ≥ 95% đúng; mỗi câu tự tin 5 mà sai được liệt kê: đó là lỗ hổng nguy hiểm nhất.
import fs from 'node:fs';
const parse = (line) => { const out = []; let c = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(c); c = ''; } else c += ch; } out.push(c); return out; };
const [head, ...rows] = fs.readFileSync(process.argv[2] || 'journal.csv', 'utf8').trim().split('\n').map(parse);
const i = Object.fromEntries(head.map((h, k) => [h, k]));
const agg = (key) => { const g = {}; for (const r of rows) { const k = r[i[key]]; (g[k] ??= [0, 0])[1]++; if (r[i.dung_sai] === 'dung') g[k][0]++; } return Object.fromEntries(Object.entries(g).map(([k, [a, n]]) => [k, `${a}/${n} = ${Math.round((100 * a) / n)}%`])); };
console.log('theo block:', agg('block'));
console.log('theo tự tin:', agg('tu_tin_1_5'));
const bad = rows.filter((r) => r[i.tu_tin_1_5] === '5' && r[i.dung_sai] !== 'dung');
if (bad.length) console.log('TỰ TIN 5 MÀ SAI:', bad.map((r) => `${r[i.block]}/${r[i.ma_cau]} (${r[i.khai_niem]})`).join('; '));
