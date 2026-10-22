// Lesson 1-5 — libuv thread pool: UV_THREADPOOL_SIZE and off-thread work.
//
// Run as-is, then with a bigger pool:
//
//   node code/1-node-anatomy-event-loop/1-5-libuv-thread-pool/demo.js
//   UV_THREADPOOL_SIZE=8 node code/1-node-anatomy-event-loop/1-5-libuv-thread-pool/demo.js
//
// Expected output (numbers vary; batches are the point):
//
//   pool size 4 (default): done in 2 batches: 1-4 together, then 5-6
//   total ~XXXms
//   pool size 8: done in 1 batch: all 6 together
//
// crypto.pbkdf2 runs ON THE THREAD POOL. With the default 4 threads,
// jobs 5 and 6 wait for a free thread — two waves. More threads, one wave.

import { promisify } from 'node:util';
import { pbkdf2 } from 'node:crypto';

const pbkdf2Async = promisify(pbkdf2);

const size = Number(process.env.UV_THREADPOOL_SIZE ?? 4);
console.log(`pool size ${size} ${size === 4 ? '(default)' : ''} — pbkdf2 x6:`);

const t0 = process.hrtime.bigint();
const ms = () => Number(process.hrtime.bigint() - t0) / 1e6;

const jobs = Array.from({ length: 6 }, (_, i) =>
  pbkdf2Async('secret', `salt-${i}`, 200_000, 32, 'sha256')
    .then(() => console.log(`  job ${i + 1} done at +${ms().toFixed(0)}ms`))
    .catch(() => console.log(`  job ${i + 1} failed`)),
);

await Promise.all(jobs);
console.log(`total +${ms().toFixed(0)}ms`);
console.log('--- key idea ---');
console.log('fs/DNS/pbkdf2 run on the pool, NOT your JS thread — the loop stays free.');
console.log('Pool size is fixed at startup: set UV_THREADPOOL_SIZE before node starts.');
