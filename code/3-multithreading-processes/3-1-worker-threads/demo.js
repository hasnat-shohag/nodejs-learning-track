// Lesson 3-1 — worker_threads: Worker, MessageChannel, transfer vs clone.
//
// Expected output:
//
//   [1] main threadId=0 pid=... 
//   [2] worker threadId=1 pid=SAME pid — one process, two threads
//   [3] clone: worker got 64MB; main copy still 64MB (bytes were copied)
//   [4] transfer: worker got 64MB; main copy byteLength=0 (bytes MOVED)
//
// A Worker is a second V8 isolate + event loop on its own OS thread inside
// the SAME process. postMessage without a transfer list COPIES (structured
// clone); listing a buffer in the transfer list MOVES its backing memory
// and detaches the sender's view — zero copy, zero duplication.

import { Worker, isMainThread, parentPort, threadId } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const MB = 1024 * 1024;

if (isMainThread) {
	console.log(`[1] main threadId=${threadId} pid=${process.pid}`);
	const w = new Worker(fileURLToPath(import.meta.url));

	const done = new Promise((resolve) => w.on('message', resolve));

	// [2]+[3] clone: postMessage copies the buffer
	const big = new ArrayBuffer(64 * MB);
	new Uint8Array(big)[0] = 42;
	w.postMessage({ kind: 'clone', buf: big }); // NO transfer list: full copy
	const cloneMsg = await done;
	console.log(`[2] ${cloneMsg}`);
	console.log(`[3] clone: main copy still ${big.byteLength / MB}MB (structured clone copied the bytes)`);

	// [4] transfer: move the backing store, no copy
	const move = new ArrayBuffer(64 * MB);
	new Uint8Array(move)[0] = 7;
	w.postMessage({ kind: 'transfer', buf: move }, [move]); // transfer list: MOVE
	console.log(`    transfer done: main copy byteLength=${move.byteLength} (detached immediately)`);
	const transferMsg = await new Promise((resolve) => w.on('message', resolve));
	console.log(`[4] ${transferMsg}`);

	w.postMessage({ kind: 'exit' });
	await w.terminate();
	console.log('--- key idea ---');
	console.log('Worker = own isolate + event loop + thread, one process. Clone copies; transfer moves.');
} else {
	parentPort.on('message', ({ kind, buf }) => {
		if (kind === 'exit') return;
		const how = kind === 'clone' ? 'copy (clone)' : 'moved (transfer)';
		parentPort.postMessage(
			`worker threadId=${threadId} pid=${process.pid} got ${buf.byteLength / MB}MB by ${how}, byte0=${new Uint8Array(buf)[0]}`,
		);
	});
}
