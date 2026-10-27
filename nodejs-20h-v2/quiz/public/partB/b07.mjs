import { spawn } from 'node:child_process';
const c = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: 'ignore' });
setTimeout(() => c.kill('SIGTERM'), 200);
setTimeout(() => { console.log('alive 500 ms after SIGTERM:', c.exitCode === null && c.signalCode === null); c.kill('SIGKILL'); }, 700);
