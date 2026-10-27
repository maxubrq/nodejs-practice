// Main module (CJS). List every possible output order.
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
