async function a() { console.log('a1'); await null; console.log('a2'); await null; console.log('a3'); }
a();
Promise.resolve().then(() => console.log('p1')).then(() => console.log('p2')).then(() => console.log('p3'));
console.log('sync');
