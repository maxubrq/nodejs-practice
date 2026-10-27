import { setTimeout as sleep } from 'node:timers/promises';
try { await sleep(1000, null, { signal: AbortSignal.timeout(100) }); }
catch (e) { console.log('name:', e.name, '| cause:', e.cause?.name); }
