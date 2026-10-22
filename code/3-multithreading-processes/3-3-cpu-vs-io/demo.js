// Lesson 3-3 — CPU-bound vs I/O-bound: benchmark sync vs worker.
//
// Expected output (times vary; SHAPE is the lesson):
//
//   [1] sync CPU work on the main loop: pings spike to work-duration
//   [2] same work in a Worker: pings stay flat
//   [3] I/O-bound load needs NO worker: pings stay flat with zero threads
//
// CPU-bound work on the event loop starves every callback; moved to a
// Worker it costs nothing to responsiveness. I/O-bound work never needed
// a thread at all — that is what the event loop is for.

import { Worker } from 'node:worker_threads';
import { setTimeout as sleep } from 'node:timers/promises';
import { pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pbkdf2Async = promisify(pbkdf2);

let last = process.hrtime.bigint();
const gaps = [];
const probe = setInterval(() => {
	const now = process.hrtime.bigint();
	gaps.push(Number(now - last) / 1e6);
	last = now;
}, 25);
const resetGaps = () => { gaps.length = 0; };
const worst = () => gaps.length ? Math.max(...gaps).toFixed(0) : '(no ping yet)';

// [1] sync CPU burn on the main thread: the probe cannot fire during the
// block — the gap AFTER it swallows the whole burn
console.log('[1] 300ms of sync CPU work ON the event loop:');
resetGaps();
await sleep(50); // let one normal ping land first
{
	const end = process.hrtime.bigint() + 300_000_000n;
	while (process.hrtime.bigint() < end) {}
}
await sleep(50); // the first post-block ping records the true damage
console.log(`  worst ping gap: ${worst()}ms (probe fires every 25ms) — loop was BLOCKED`);

// [2] same 300ms of CPU, inside a Worker
console.log('[2] 300ms of CPU work inside a Worker:');
resetGaps();
await sleep(50);
{
	const workerSrc = `
	import { pbkdf2 } from 'node:crypto';
	import { promisify } from 'node:util';
	const pbkdf2Async = promisify(pbkdf2);
	await pbkdf2Async('k', 's', 3_000_000, 32, 'sha256'); // ~300ms of CPU
	`;
	const f = join(tmpdir(), `cpu-worker-${process.pid}.mjs`);
	writeFileSync(f, workerSrc);
	const w = new Worker(f);
	await new Promise((r) => w.on('exit', r));
}
await sleep(50);
console.log(`  worst ping gap: ${worst()}ms — loop kept serving while the worker burned CPU`);

// [3] I/O-bound work: needs no worker at all
console.log('[3] 24 concurrent pbkdf2 ops (libuv thread pool) — no Worker spawned:');
resetGaps();
await sleep(50);
{
	const jobs = Array.from({ length: 24 }, () => pbkdf2Async('k', 's', 100_000, 32, 'sha256'));
	await Promise.all(jobs);
}
await sleep(50);
console.log(`  worst ping gap: ${worst()}ms — event loop + libuv pool handled it, zero Workers`);

clearInterval(probe);
console.log('--- key idea ---');
console.log('CPU-bound goes to a Worker; I/O-bound already has the loop and the pool.');
