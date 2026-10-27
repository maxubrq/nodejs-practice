// Which of these crash the process under the default --unhandled-rejections mode?
// Run: node e2-unhandled.mjs <case>   cases: late-timeout | late-await | late-nexttick | late-immediate
const c = process.argv[2];
process.on('exit', (code) => console.log(`[${c}] exit code ${code}`));
const p = Promise.reject(new Error('boom'));
if (c === 'late-timeout') setTimeout(() => p.catch(() => console.log(`[${c}] caught`)), 0);
if (c === 'late-await') { await null; await null; p.catch(() => console.log(`[${c}] caught`)); }
if (c === 'late-nexttick') process.nextTick(() => p.catch(() => console.log(`[${c}] caught`)));
if (c === 'late-immediate') setImmediate(() => p.catch(() => console.log(`[${c}] caught`)));
