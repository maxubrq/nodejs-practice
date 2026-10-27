Promise.resolve().then(() => {
  console.log('then1');
  process.nextTick(() => console.log('tick-from-then'));
  Promise.resolve().then(() => console.log('then-from-then'));
}).then(() => console.log('then2'));
process.nextTick(() => console.log('tick1'));
