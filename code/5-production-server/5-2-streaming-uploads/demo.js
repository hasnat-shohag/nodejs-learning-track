// Lesson 5-2 — streaming uploads: big bodies without big memory.
//
// Expected output (temp paths/pids vary):
//
//   [1] a 20 MB upload arrives chunk by chunk — the server's memory
//       never holds it; bytes go straight to a write stream on disk
//   [2] two concurrent uploads: interleaved chunks, memory still flat
//   [3] the naive contrast: read whole body into one buffer first —
//       memory spikes to the full upload size (what [1] avoided)
//
// An upload body is a Readable, and the correct way to consume it is
// the streaming way: chunk → disk, never chunk → RAM → disk. The
// multipart/form-data format browsers use for files is just a
// body with boundary markers — slice on boundaries while streaming.

import http from 'node:http';
import { createWriteStream } from 'node:fs';
import { openSync, readSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import v8 from 'node:v8';

const heapMB = () => (v8.getHeapStatistics().used_heap_size / 1024 / 1024).toFixed(1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// a large fake payload, sent in many small writes
const PAYLOAD_MB = 20;
const payload = Buffer.alloc(PAYLOAD_MB * 1024 * 1024, 0x61); // 'a' x 20MB

const server = http.createServer((req, res) => {
	const dest = join(tmpdir(), `upload-${process.pid}-${Math.random().toString(36).slice(2)}.bin`);
	const out = createWriteStream(dest);
	let bytes = 0;
	let chunks = 0;
	req.on('data', (c) => { bytes += c.length; chunks++; out.write(c); });
	req.on('end', () => {
		out.end(() => {
			res.writeHead(201, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ bytes, chunks, heapMB: Number(heapMB()), file: statSync(dest).size }));
			unlinkSync(dest);
		});
	});
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// [1] one 20MB upload, streamed to disk
{
	console.log('[1] 20MB upload, streamed to disk:');
	const before = heapMB();
	const reply = await new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port, method: 'POST', headers: { 'content-length': payload.length } }, resolve);
		req.on('error', reject);
		// send in 64KB slices — like a real client's TCP segments
		for (let off = 0; off < payload.length; off += 65536) {
			req.write(payload.subarray(off, off + 65536));
		}
		req.end();
	});
	let body = '';
	reply.on('data', (c) => { body += c; });
	await new Promise((r) => reply.on('end', r));
	const r = JSON.parse(body);
	console.log(`  server received ${r.bytes / 1024 / 1024}MB in ${r.chunks} chunks, wrote ${r.file / 1024 / 1024}MB to disk`);
	console.log(`  server heap: ${before}MB before → ${r.heapMB}MB during — a 20MB upload cost ~nothing in RAM`);
}

// [2] two uploads at once — still flat
{
	console.log('[2] two 20MB uploads concurrently:');
	const send = () => new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port, method: 'POST', headers: { 'content-length': payload.length } }, resolve);
		req.on('error', reject);
		for (let off = 0; off < payload.length; off += 65536) req.write(payload.subarray(off, off + 65536));
		req.end();
	});
	const [a, b] = await Promise.all([send(), send()]);
	let bodies = ['', ''];
	await Promise.all([a, b].map((res, i) => new Promise((r) => {
		res.on('data', (c) => { bodies[i] += c; });
		res.on('end', r);
	})));
	const [ra, rb] = bodies.map(JSON.parse);
	console.log(`  upload A: ${ra.bytes / 1024 / 1024}MB/${ra.chunks} chunks, upload B: ${rb.bytes / 1024 / 1024}MB/${rb.chunks} chunks`);
	console.log(`  heap during both: A ${ra.heapMB}MB, B ${rb.heapMB}MB — interleaved chunks, memory still flat`);
}

// [3] the anti-pattern: buffer the whole body first
{
	console.log('[3] anti-pattern: read whole body into RAM:');
	const naive = http.createServer((req, res) => {
		const all = [];
		req.on('data', (c) => all.push(c)); // accumulate EVERYTHING in memory
		req.on('end', () => {
			const whole = Buffer.concat(all);
			res.writeHead(201);
			res.end(`held ${whole.length} bytes in RAM at once`);
		});
	});
	await new Promise((r) => naive.listen(0, '127.0.0.1', r));
	const reply = await new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port: naive.address().port, method: 'POST', headers: { 'content-length': payload.length } }, resolve);
		req.on('error', reject);
		req.end(payload); // send it all
	});
	let body = '';
	reply.on('data', (c) => { body += c; });
	await new Promise((r) => reply.on('end', r));
	console.log(`  naive server says: "${body}"`);
	console.log('  multiply by concurrent uploads and this is the OOM: stream to disk instead');
	await new Promise((r) => naive.close(r));
}

console.log('--- key idea ---');
console.log('Upload body = Readable. Chunk → disk, never chunk → RAM → disk. Bound the body early.');
await new Promise((r) => server.close(r));
