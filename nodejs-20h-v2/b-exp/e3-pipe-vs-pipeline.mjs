// Source errors after 3 chunks. Compare .pipe() with stream.pipeline() on a file destination.
// Predict: is dest destroyed? is its fd closed? does the process see an error?
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

function failing() {
  let i = 0;
  return new Readable({
    read() { if (++i <= 3) this.push('chunk' + i + '\n'); else this.destroy(new Error('source failed')); },
  });
}
const fdCount = () => fs.readdirSync('/proc/self/fd').length;
const base = fdCount();

{
  const dest = fs.createWriteStream(path.join(os.tmpdir(), 'e3-pipe.txt'));
  const src = failing();
  src.on('error', () => {});
  src.pipe(dest);
  await sleep(100);
  console.log(`pipe():     dest.destroyed=${dest.destroyed} dest.closed=${dest.closed} extraFds=${fdCount() - base}`);
  dest.destroy();
  await sleep(50);
}
{
  const dest = fs.createWriteStream(path.join(os.tmpdir(), 'e3-pipeline.txt'));
  try { await pipeline(failing(), dest); } catch (e) { console.log(`pipeline(): rejected with "${e.message}"`); }
  await sleep(50);
  console.log(`pipeline(): dest.destroyed=${dest.destroyed} dest.closed=${dest.closed} extraFds=${fdCount() - base}`);
}
