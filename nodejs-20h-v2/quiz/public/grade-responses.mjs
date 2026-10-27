// Grade a Google Forms CSV export and place "me" in the distribution.
//   node grade-responses.mjs responses.csv partA/key.json partB/key-partB.json --me "<my email or name>"
// CSV: first row = header; a column is a question if its header starts with its id (e.g. "G03 ...", "B05 ...").
// Keys: generator key.json ({answers:{g01:"ACBD"}}) and/or a flat {"B01":"C"} map; several files are merged.
// Multiple-choice answers match by first letter; order answers ("ACBD") must match exactly.
// Output: score per respondent, histogram, my rank, one-sided binomial p-value for H0 "my percentile <= 95%",
// and the Clopper-Pearson 95% lower bound on my percentile.
import fs from 'node:fs';

const meIdx = process.argv.indexOf('--me');
const me = process.argv[meIdx + 1];
const [csvPath, ...keyPaths] = process.argv.slice(2, meIdx);
const key = {};
for (const k of keyPaths) {
  const j = JSON.parse(fs.readFileSync(k, 'utf8'));
  for (const [id, v] of Object.entries(j.answers || j)) key[id.toUpperCase()] = String(v).toUpperCase();
}
const correct = (ans, k) => { const a = (ans || '').trim().toUpperCase().replace(/[\s,>-]/g, ''); return k.length === 1 ? a.startsWith(k) : a === k; };

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const [header, ...data] = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const qCols = header.map((h, i) => [h.match(/^([A-Za-z]\d+)/)?.[1]?.toUpperCase(), i]).filter(([id]) => id && key[id]);
const idCol = header.findIndex((h) => /email|name|tên/i.test(h));
const people = data.filter((r) => r.length > 1).map((r) => ({
  who: r[idCol] ?? '?',
  score: qCols.reduce((s, [id, i]) => s + (correct(r[i], key[id]) ? 1 : 0), 0),
}));
const mine = people.find((p) => p.who === me);
const peers = people.filter((p) => p !== mine);
if (!mine) { console.error('me not found:', me); process.exit(1); }

const hist = {};
for (const p of peers) hist[p.score] = (hist[p.score] || 0) + 1;
console.log(`questions graded: ${qCols.length}, peers: ${peers.length}`);
for (const s of Object.keys(hist).sort((a, b) => a - b)) console.log(String(s).padStart(3), '#'.repeat(hist[s]), s == mine.score ? '<- me' : '');

const below = peers.filter((p) => p.score < mine.score).length;
const ties = peers.filter((p) => p.score === mine.score).length;
const n = peers.length;
const beaten = below + ties / 2;
console.log(`my score ${mine.score}/${qCols.length}; strictly above ${below}, tied ${ties}, of ${n} peers -> empirical percentile ${(100 * beaten / n).toFixed(1)}%`);

// P(Binom(n, 0.95) >= k) with k = number strictly beaten (conservative: ties count as not beaten)
const lnC = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
const binomTail = (n, k, p) => { let s = 0; for (let j = k; j <= n; j++) s += Math.exp(lnC(n, j) + j * Math.log(p) + (n - j) * Math.log(1 - p)); return s; };
const pval = binomTail(n, below, 0.95);
console.log(`H0 "my percentile <= 95%": one-sided p = ${pval.toFixed(4)} (${pval < 0.05 ? 'rejected at 0.05' : 'not rejected'})`);
// Clopper-Pearson one-sided 95% lower bound for the proportion of peers below me
let lo = 0, hi = 1;
for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (binomTail(n, below, mid) < 0.05) lo = mid; else hi = mid; }
console.log(`95% lower bound on my percentile: ${(100 * lo).toFixed(1)}%  (need >= 95.0 to claim "top 5%")`);
console.log(`peers needed if you beat everyone: ${Math.ceil(Math.log(0.05) / Math.log(0.95))}`);
