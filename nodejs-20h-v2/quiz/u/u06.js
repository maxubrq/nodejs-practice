setImmediate(() => { console.log('imm1'); process.nextTick(() => console.log('tick')); Promise.resolve().then(() => console.log('then')); });
setImmediate(() => console.log('imm2'));
