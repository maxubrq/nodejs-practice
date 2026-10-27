// Q: AbortSignal.any([controller.signal, AbortSignal.timeout(50)]) hết hạn. reason.name là gì?
const ac = new AbortController();
const s = AbortSignal.any([ac.signal, AbortSignal.timeout(50)]);
s.addEventListener('abort', () => console.log(`aborted reason=${s.reason.name}`));
setTimeout(() => {}, 100);
