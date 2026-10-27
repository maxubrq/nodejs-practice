// Same regex, same input; first call vs later calls. Run: node redos-tierup.js [flags]
const re = /^([a-zA-Z0-9]+\s?)+$/;
const s = 'a'.repeat(24) + '!';
for (let i = 0; i < 3; i++) { const t = performance.now(); re.test(s); console.log('call', i + 1, (performance.now() - t).toFixed(1), 'ms'); }
