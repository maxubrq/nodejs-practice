// Default --unhandled-rejections mode. Does the process crash? Print exit code.
process.on('exit', (c) => console.log('exit', c));
const p = Promise.reject(new Error('boom'));
await null; await null;
p.catch(() => console.log('caught'));
