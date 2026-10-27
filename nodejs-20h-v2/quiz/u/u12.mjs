process.on('exit', (c) => console.log('exit', c));
const p = Promise.reject(new Error('boom'));
setImmediate(() => p.catch(() => console.log('caught')));
