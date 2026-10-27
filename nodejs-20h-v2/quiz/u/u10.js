process.on('exit', (code) => {
  console.log('exit', code);
  setTimeout(() => console.log('timer in exit'), 0);
  Promise.resolve().then(() => console.log('then in exit'));
});
console.log('main');
