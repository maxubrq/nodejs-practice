const re = /^([a-zA-Z0-9]+\s?)+$/;
for (const n of [16, 18, 20, 22, 24, 26]) {
  const s = 'a'.repeat(n) + '!';
  const t = performance.now(); re.test(s); console.log(n, (performance.now() - t).toFixed(1) + ' ms');
}
