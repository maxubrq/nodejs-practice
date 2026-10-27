const a = new AbortController(), b = new AbortController();
const s = AbortSignal.any([a.signal, b.signal]);
setTimeout(() => b.abort(new Error('from b')), 10);
setTimeout(() => a.abort(new Error('from a')), 20);
s.addEventListener('abort', () => setTimeout(() => console.log('reason:', s.reason.message), 30));
