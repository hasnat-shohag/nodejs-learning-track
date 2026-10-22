// Lesson 4-5 — the four stream classes, one run each.
//
// Expected output (buffer sizes vary slightly; the shapes are the lesson):
//
//   [1] Readable: data flows chunk by chunk — pause() actually
//       stops the flow, resume() restarts it
//   [2] Writable: write() returns false once the internal buffer
//       passes highWaterMark — that bool is the backpressure signal
//   [3] Duplex: readable and writable ends are INDEPENDENT —
//       write side full does not stop the read side
//   [4] Transform: in → fn → out, a pipeline stage you can snap
//       between any two streams
//
// Every data mover in Node is one of these four: fs streams, sockets,
// zlib, crypto, process.stdin/stdout. The API you learn here is the
// API everywhere.

import { Readable, Writable, Duplex, Transform } from 'node:stream';
import { createGzip } from 'node:zlib';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// [1] Readable: chunks on demand, pause/resume gate the flow
{
	console.log('[1] Readable:');
	const src = Readable.from(['a', 'b', 'c', 'd'], { objectMode: true });
	const order = [];
	let n = 0;
	src.on('data', (c) => {
		n++;
		if (n === 2) {
			src.pause();
			order.push(`  chunk 2 arrived → paused; nothing further until resume()`);
		} else {
			order.push(`  chunk ${n}: ${c}`);
		}
	});
	await sleep(50);
	order.push('  (50ms passed — still paused, no data events)');
	src.resume();
	await new Promise((r) => src.on('end', r));
	order.push('  resumed → chunks 3, 4 flowed, then end');
	console.log(order.join('\n'));
}

// [2] Writable: write() returns a bool — false means buffer full
{
	console.log('[2] Writable:');
	let backpressure = 0;
	const sink = new Writable({
		highWaterMark: 16,
		write(chunk, enc, cb) { setTimeout(cb, 1); },
	});
	for (let i = 0; i < 12; i++) {
		const ok = sink.write('x'.repeat(4)); // 4 bytes per write
		if (!ok) backpressure++;
	}
	console.log(`  wrote 48 bytes into a 16-byte highWaterMark — write() returned false ${backpressure} time(s)`);
	console.log('  that false is THE signal: stop pushing, wait for drain, then write again');
	await new Promise((r) => sink.end(r));
}

// [3] Duplex: both ends, independently buffered
{
	console.log('[3] Duplex:');
	const both = new Duplex({
		read() { this.push('r1'); this.push('r2'); this.push(null); },
		write(chunk, enc, cb) { setTimeout(cb, 1); },
	});
	const reads = [];
	both.on('data', (c) => reads.push(c.toString()));
	const readDone = new Promise((r) => both.on('end', r));
	for (let i = 0; i < 20; i++) both.write('w'); // fill the write side past ITS buffer
	await new Promise((r) => both.end(r));       // write side drained
	await readDone;                               // read side finished too
	console.log(`  read side delivered ${reads.length} chunks (${reads.join(',')}) while write side took 20 writes`);
	console.log('  the two sides are separate buffers — one filling does not gate the other');
}

// [4] Transform: a stage with in and out
{
	console.log('[4] Transform:');
	const upper = new Transform({
		transform(chunk, enc, cb) { cb(null, chunk.toString().toUpperCase()); },
	});
	upper.write('hello ');
	upper.write('streams');
	upper.end();
	let out = '';
	for await (const c of upper) out += c;
	console.log(`  wrote 'hello streams' through uppercase stage → '${out}'`);

	// the same stage snaps into a real pipeline: gzip is a Transform
	const gz = createGzip();
	gz.write('hello streams');
	gz.end();
	let bytes = 0;
	for await (const c of gz) bytes += c.length;
	console.log(`  createGzip() is the same shape: 13 bytes in → ${bytes} gzip bytes out — a Transform in the wild`);
}

console.log('--- key idea ---');
console.log('Four classes, one API: data, end, write() bools, pipe(). Every mover in Node speaks it.');
