// Lesson 3-4 — Worker pool pattern: reuse, queue, pool sizing.
//
// Expected output (wall times vary; the COUNTS are the lesson):
//
//   [1] spawn-per-job, 8 jobs: 8 spawns, peak 8 concurrent workers,
//       each worker = its own V8 heap, spawn cost paid 8 times
//   [2] pool of 4, same 8 jobs: 4 spawns, peak 4, each worker runs 2
//       jobs — reuse proven by threadId counts
//   [3] burst of 20 into pool of 4: peak stays 4, queue drains
//       16 → 0, all 20 served, no spawn storm
//
// On a many-core box [1] can even win wall-clock — every one-shot gets a
// core. The pool still wins what production cares about: spawns and peak
// workers stay constant no matter how many jobs arrive. Per-job spawn is
// ~30ms plus a full heap; a pool pays that once.
//
// Sizing rule of thumb: pool = CPU cores for CPU-bound work.

import { Worker } from 'node:worker_threads';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// one-shot worker: runs its job on spawn, exits (the naive pattern)
const once = join(tmpdir(), `pool-once-${process.pid}.mjs`);
writeFileSync(once, `
import { pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';
await promisify(pbkdf2)('k', 's', 1_500_000, 32, 'sha256'); // ~150ms CPU
`);

// pooled worker: idles until a message, runs the job, replies, idles again
const pooled = join(tmpdir(), `pool-worker-${process.pid}.mjs`);
writeFileSync(pooled, `
import { parentPort, threadId } from 'node:worker_threads';
import { pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';
const pbkdf2Async = promisify(pbkdf2);
parentPort.on('message', async (jobId) => {
	await pbkdf2Async('k', 's', 1_500_000, 32, 'sha256'); // ~150ms CPU
	parentPort.postMessage({ jobId, threadId });
});
`);
process.on('exit', () => { rmSync(once, { force: true }); rmSync(pooled, { force: true }); });

// per-section concurrency bookkeeping
function tracker() {
	const s = { spawns: 0, peak: 0, live: 0 };
	s.track = (w) => {
		s.spawns++; s.live++; s.peak = Math.max(s.peak, s.live);
		w.on('exit', () => s.live--);
		return w;
	};
	return s;
}

// pool: size workers, a shared queue, each idle worker takes the next job
async function runPool(file, size, jobs, t) {
	const queue = [...jobs];
	const served = [];
	const depth = []; // queue length after each completion
	await new Promise((allDone) => {
		let idle = 0;
		for (let i = 0; i < size; i++) {
			const worker = t.track(new Worker(file));
			const take = () => {
				const jobId = queue.shift();
				if (jobId === undefined) {
					worker.terminate();
					if (++idle === size) allDone();
					return;
				}
				worker.once('message', (m) => { served.push(m); depth.push(queue.length); take(); });
				worker.postMessage(jobId);
			};
			worker.once('online', take);
		}
	});
	return { served, depth };
}

console.log('[1] spawn-per-job (8 jobs, one fresh worker each):');
{
	const t = tracker();
	const t0 = performance.now();
	await Promise.all(Array.from({ length: 8 }, () => {
		const w = t.track(new Worker(once));
		return new Promise((r) => w.on('exit', r));
	}));
	const dt = performance.now() - t0;
	console.log(`  spawns=${t.spawns}, peak concurrent workers=${t.peak}, ${dt.toFixed(0)}ms`);
	console.log('  every job paid ~30ms spawn + its own V8 heap; counts scale with jobs');
}

console.log('[2] pool of 4, same 8 jobs:');
{
	const t = tracker();
	const t0 = performance.now();
	const { served } = await runPool(pooled, 4, Array.from({ length: 8 }, (_, i) => i), t);
	const dt = performance.now() - t0;
	const perThread = new Map();
	for (const m of served) perThread.set(m.threadId, (perThread.get(m.threadId) ?? 0) + 1);
	console.log(`  spawns=${t.spawns}, peak concurrent workers=${t.peak}, ${dt.toFixed(0)}ms`);
	console.log(`  jobs per worker (by threadId): ${[...perThread.values()].join('/')} — 4 workers × 2 jobs = reuse`);
}

console.log('[3] burst of 20 jobs into pool of 4 (queue holds overflow):');
{
	const t = tracker();
	const { served, depth } = await runPool(pooled, 4, Array.from({ length: 20 }, (_, i) => i), t);
	console.log(`  spawns=${t.spawns}, peak concurrent workers=${t.peak} — spawn count did NOT scale with the burst`);
	console.log(`  served ${served.length}/20; queue depth after each completion: ${depth.slice(0, 4).join(' ')} … ${depth.slice(-3).join(' ')} — drained to 0, nothing lost`);
}
console.log('--- key idea ---');
console.log('Pool = spawn once, message work, queue overflow. Spawns and peak workers stay');
console.log('constant however many jobs arrive. Size pool to CPU cores for CPU-bound work.');
