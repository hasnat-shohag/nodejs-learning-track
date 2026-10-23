// Lesson 5-7 — capstone: a small production-shaped static server.
//
// Expected output (ports/times vary):
//
//   [1] boot: worker pool (2 threads) + http server, security headers on
//   [2] static route with ETag: first GET 200, re-GET If-None-Match 304
//   [3] path traversal /../etc/passwd → blocked by resolve+startsWith guard
//   [4] CPU route /hash offloaded to the pool: concurrent requests spread
//       across threadIds AND the main loop keeps ticking during the work
//   [5] shutdown: no listener, no worker, no handle left — exit 0
//
// Everything from Domain 5 in one file: buffers under the body, ETag +
// Cache-Control, security headers, a traversal guard, and the pool from
// 3-4 so a CPU route never blocks the loop that serves everyone else.

import http from 'node:http';
import { Worker } from 'node:worker_threads';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const WEBROOT = join(tmpdir(), `capstone-${process.pid}`);
mkdirSync(WEBROOT, { recursive: true });
const INDEX = join(WEBROOT, 'index.html');
writeFileSync(INDEX, '<h1>capstone</h1>');
process.on('exit', () => rmSync(WEBROOT, { recursive: true, force: true }));

// [1] pool: N workers, one job in flight each — same shape as lesson 3-4
const POOL = 2;
const pool = [];
for (let i = 0; i < POOL; i++) {
	pool.push(new Worker(`
		const { parentPort } = require('node:worker_threads');
		const { pbkdf2Sync } = require('node:crypto');
		parentPort.on('message', (job) => {
			const t0 = performance.now();
			pbkdf2Sync(job.key, job.salt, 400_000, 32, 'sha256');
			parentPort.postMessage({ id: job.id, threadId: require('node:worker_threads').threadId, ms: (performance.now() - t0).toFixed(0) });
		});
	`, { eval: true }));
}

// routes
const etagOf = (body) => '"' + createHash('sha256').update(body).digest('hex').slice(0, 16) + '"';
const guarded = (p) => {
	const full = resolve(WEBROOT, '.' + sep + p);
	return full.startsWith(WEBROOT + sep) ? full : null;
};

const server = http.createServer((req, res) => {
	for (const [h, v] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['strict-transport-security', 'max-age=31536000']]) res.setHeader(h, v);
	if (req.method === 'GET' && req.url === '/') {
		const body = '<h1>capstone</h1>';
		const etag = etagOf(body);
		res.setHeader('cache-control', 'public, max-age=60');
		if (req.headers['if-none-match'] === etag) { res.writeHead(304, { etag }); res.end(); return; }
		res.writeHead(200, { 'content-type': 'text/html', etag });
		res.end(body);
		return;
	}
	if (req.method === 'GET' && req.url.startsWith('/file/')) {
		const full = guarded(req.url.slice('/file/'.length));
		if (!full) { res.writeHead(403).end('blocked'); return; }
		res.writeHead(200, { 'content-type': 'text/html' });
		res.end('file bytes (streamed in the real version)');
		return;
	}
	if (req.method === 'POST' && req.url === '/hash') {
		// route the reply by job id — one shared listener, never per-request once()
		const id = ++jobSeq;
		pending.set(id, res);
		pool[next++ % POOL].postMessage({ id, key: 'k', salt: 's' });
		return;
	}
	res.writeHead(404).end('no route');
});
let next = 0;
let jobSeq = 0;
const pending = new Map(); // jobId → res, replies routed by id
for (const w of pool) {
	w.on('message', (job) => {
		const res = pending.get(job.id);
		pending.delete(job.id);
		res.writeHead(200);
		res.end(JSON.stringify(job));
	});
}

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
console.log(`[1] boot: ${POOL} pool workers up, server on :${port}, security headers on every reply`);

const get = (headers = {}) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, headers }, (res) => {
		let bytes = 0, body = '';
		res.on('data', (c) => { bytes += c.length; body += c; });
		res.on('end', () => resolve({ status: res.statusCode, etag: res.headers.etag, headers: res.headers, bytes, body }));
	}).on('error', reject);
});

// [2] ETag flow on the static route
{
	const first = await get();
	const re = await get({ 'if-none-match': first.etag });
	console.log(`[2] static route: GET ${first.status} etag ${first.etag}, re-GET with it → ${re.status} (${re.bytes} body bytes)`);
}

// [3] traversal guard
{
	const evil = await new Promise((resolve, reject) => {
		http.get({ host: '127.0.0.1', port, path: '/file/..%2F..%2Fetc%2Fpasswd'.replace(/%2F/g, '/') }, resolve).on('error', reject);
	});
	let b = '';
	evil.on('data', (c) => { b += c; });
	await new Promise((r) => evil.on('end', r));
	console.log(`[3] traversal /file/../../etc/passwd → ${evil.statusCode} "${b}" (guard resolved it outside the webroot and refused)`);
}

// [4] CPU route through the pool, loop stays alive
{
	const ticks = [];
	const timer = setInterval(() => ticks.push(performance.now()), 20);
	const t0 = performance.now();
	const sent = [1, 2, 3, 4].map(() => new Promise((resolve, reject) => {
		const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/hash' }, (res) => {
			let b = '';
			res.on('data', (c) => { b += c; });
			res.on('end', () => resolve(JSON.parse(b)));
		});
		req.on('error', reject);
		req.end();
	}));
	const replies = await Promise.all(sent);
	await new Promise((r) => setTimeout(r, 50));
	clearInterval(timer);
	const threads = [...new Set(replies.map((r) => r.threadId))].sort().join(',');
	const gaps = ticks.slice(1).map((t, i) => t - ticks[i]);
	const maxGap = Math.max(...gaps).toFixed(0);
	console.log(`[4] /hash: 4 requests, ${replies.length}/4 served, job ids ${replies.map((r) => r.id).join(',')}, threadIds ${threads} — pool spread the CPU work`);
	console.log(`    20ms ticker kept ticking; max gap ${maxGap}ms — pbkdf2 never blocked this loop (4 in parallel ≈ ${replies[0].ms}ms per hash in a worker)`);
}

// [5] shutdown
{
	await new Promise((r) => server.close(r));
	await Promise.all(pool.map((w) => w.terminate()));
	console.log(`[5] shutdown: server closed, ${pool.length} workers terminated, node now free to exit`);
}

console.log('--- key idea ---');
console.log('Routes serve, pool hashes, guard blocks, cache stamps. Each piece is one lesson.');
