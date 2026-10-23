// Lesson 4-6 — backpressure: write() bools, drain, and what pipe saves you.
//
// Expected output (sizes vary; the shapes are the lesson):
//
//   [1] slow sink + fast source: write() returns false, buffer
//       swells past highWaterMark — this is backpressure arriving
//   [2] honoring the signal: on false, stop writing; 'drain' fires
//       when the buffer empties — memory stays flat
//   [3] ignoring the signal: same sink, write anyway — the buffer
//       grows without bound (bounded only because the demo stops)
//   [4] pipe(): the same control, done for you — pause/resume
//       between the same pair, zero manual code
//
// Backpressure is the writable saying "I am full, slow down". In HTTP
// it is why a fast file read does not outrun a slow client: write()
// goes false, you stop reading, memory stays flat. Ignore it and you
// buffer the whole response in RAM per slow client.

import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fast source: pushes immediately when asked
const fastSource = (n) => Readable.from(Array.from({ length: n }, (_, i) => `chunk-${String(i).padStart(3, '0')}\n`));

// slow sink: 10ms per write, small highWaterMark
const slowSink = () => new Writable({
	highWaterMark: 64,
	write(chunk, enc, cb) { setTimeout(cb, 10); },
});

// [1] the signal: write() false + a swelling buffer
{
	console.log('[1] fast source → slow sink, signal observed:');
	const sink = slowSink();
	let falses = 0, writes = 0;
	for (let i = 0; i < 20; i++) {
		writes++;
		if (!sink.write(`chunk-${i}\n`)) falses++;
		if (falses === 1 && i === 5) console.log(`  write #${i + 1} returned FALSE — buffer is past highWaterMark (64B)`);
	}
	console.log(`  ${writes} writes, ${falses} returned false — the sink cannot keep up, backpressure is ON`);
	await new Promise((r) => sink.end(r));
}

// [2] honoring it: stop on false, wait for drain
{
	console.log('[2] honoring the signal (stop → drain → write):');
	const sink = slowSink();
	const src = fastSource(30);
	let queued = 0, drained = 0;
	await new Promise((done) => {
		const pump = () => {
			while (queued < 30) {
				const ok = sink.write(`chunk-${queued}\n`);
				queued++;
				if (!ok) {
					drained++;
					sink.once('drain', pump); // buffer full: stop, wait, continue
					return;
				}
			}
			sink.end(done);
		};
		pump();
	});
	console.log(`  30 chunks delivered with ${drained} drain cycle(s) — memory stayed ~highWaterMark, not 30 chunks`);
}

// [3] ignoring it: unbounded buffer
{
	console.log('[3] ignoring the signal (write anyway):');
	const sink = slowSink();
	let falses = 0, buffered = 0;
	for (let i = 0; i < 400; i++) {
		const ok = sink.write(`chunk-${String(i).padStart(4, '0')}-padding-padding-padding\n`); // 40B each
		if (!ok) falses++;
		buffered += 40;
	}
	console.log(`  400 writes pushed, ${falses} falses ignored — ${sink.writableLength} bytes sit in the sink's internal buffer`);
	console.log('  in a real server this is the slow-client response ballooning in RAM');
	await new Promise((r) => sink.end(r));
}

// [4] pipe: the same control, for free
{
	console.log('[4] pipe():');
	const sink = slowSink();
	const src = fastSource(30);
	const t0 = performance.now();
	src.pipe(sink);
	await new Promise((r) => sink.on('finish', r));
	console.log(`  same pair, pipe() moved all 30 chunks in ${Math.round(performance.now() - t0)}ms — pause/resume handled, zero drain code written`);
}

// [5] pipeline(): the modern form, with error propagation end-to-end
{
	console.log('[5] pipeline():');
	const { Transform } = await import('node:stream');
	const badMiddle = new Transform({ transform(c, enc, cb) { cb(new Error('middle stage died')); } });
	try {
		await pipeline(Readable.from(['a', 'b', 'c']), badMiddle, slowSink());
	} catch (e) {
		console.log(`  middle stage threw → promise rejected (${e.message}), every stage destroyed — pipe() would have leaked these`);
	}
}

console.log('--- key idea ---');
console.log('write() false = stop. drain = go. pipe/pipeline = someone wrote that loop for you.');
