// Same code, but an ES module.
Promise.resolve().then(() => console.log('then'));
queueMicrotask(() => console.log('microtask'));
process.nextTick(() => console.log('tick'));
console.log('sync');
