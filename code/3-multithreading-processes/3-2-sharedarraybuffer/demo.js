// Lesson 3-2 — SharedArrayBuffer + Atomics: shared memory across threads.
//
// Expected output:
//
//   [1] plain [] access: 30M main + 5M worker → well under 35M (races)
//   [2] Atomics.add: same load → exactly 35M, every increment lands
//   [3] Atomics.wait/notify: main blocks at the OS level, no CPU spin
//
// SAB shares raw bytes with zero copy. Plain read-modify-write on shared
// bytes is a data race — both sides can read the same old value and one
// increment is lost. Atomics is the only correct tool on shared memory.

import { Worker, isMainThread, threadId, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const exited = (w) => new Promise((resolve) => w.on('exit', resolve));

if (isMainThread) {
	console.log('[1] plain [] access on shared bytes — the race:');
	const sab = new SharedArrayBuffer(4);
	const view = new Int32Array(sab);
	const N = 5_000_000; // worker side
	const MAIN_N = 30_000_000; // ~60ms of main-looping: still hot when the worker joins
	const w = new Worker(fileURLToPath(import.meta.url), { workerData: { sab, mode: 'race' } });
	for (let i = 0; i < MAIN_N; i++) view[0] += 1;
	await exited(w);
	console.log(`  main 30M + worker 5M = ${(view[0] / 1e6).toFixed(2)}M (expected 35M) — LOST UPDATES: data race`);

	console.log('[2] Atomics.add on the same shared bytes:');
	const sab2 = new SharedArrayBuffer(4);
	const safe = new Int32Array(sab2);
	const w2 = new Worker(fileURLToPath(import.meta.url), { workerData: { sab: sab2, mode: 'atomic' } });
	for (let i = 0; i < MAIN_N; i++) Atomics.add(safe, 0, 1);
	await exited(w2);
	console.log(`  same load, Atomics.add on both sides: ${safe[0] / 1e6}M of 35M (exact — ordered)`);

	console.log('[3] Atomics.wait/notify — sleep without spinning:');
	const sab3 = new SharedArrayBuffer(4);
	const flag = new Int32Array(sab3);
	const w3 = new Worker(fileURLToPath(import.meta.url), { workerData: { sab: sab3, mode: 'wait' } });
	const t0 = Date.now();
	Atomics.wait(flag, 0, 0); // blocks THIS thread at OS level until notify
	console.log(`  main woke after ${Date.now() - t0}ms — worker called Atomics.notify`);
	await exited(w3);
	console.log('--- key idea ---');
	console.log('Shared bytes need ordered access: every compound op on SAB must be an Atomics op.');
} else {
	const { sab, mode } = workerData;
	const view = new Int32Array(sab);
	if (mode === 'race') {
		for (let i = 0; i < 5_000_000; i++) view[0] += 1; // plain RMW: races with main
	} else if (mode === 'atomic') {
		for (let i = 0; i < 5_000_000; i++) Atomics.add(view, 0, 1); // ordered RMW
	} else {
		// wait mode: flip the flag then wake main. setInterval keeps this
		// worker's loop alive until the flip fires.
		const timer = setInterval(() => {
			Atomics.store(view, 0, 1);
			Atomics.notify(view, 0, 1);
			clearInterval(timer);
		}, 50);
	}
}
