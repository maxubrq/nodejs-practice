let running = 0, maxConcurrent = 0;
const t = setInterval(async () => {
  running++; maxConcurrent = Math.max(maxConcurrent, running);
  await new Promise((r) => setTimeout(r, 350));
  running--;
}, 100);
setTimeout(() => { clearInterval(t); console.log('max concurrent runs:', maxConcurrent); }, 1000);
