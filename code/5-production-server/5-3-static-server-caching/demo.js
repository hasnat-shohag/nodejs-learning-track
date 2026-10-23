// Lesson 5-3 — a static file server with ETag + Cache-Control.
//
// Expected output (port/size vary):
//
//   [1] serve a file: content-type by extension, Cache-Control set
//   [2] second request sends If-None-Match → server compares ETag
//       → 304 Not Modified, ZERO body bytes sent
//   [3] conditional flow, end to end: GET (200 + ETag + body),
//       re-GET with the ETag (304, no body), re-GET stale (200)
//
// Caching is a contract between server and browser: the server stamps
// the body (ETag) and states the policy (Cache-Control); the browser
// must revalidate when the policy says so and reuses the copy when
// the stamp still matches.

import http from 'node:http';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const file = join(tmpdir(), `static-${process.pid}.html`);
writeFileSync(file, '<h1>cached lesson</h1>');
process.on('exit', () => rmSync(file, { force: true }));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const ext = (p) => p.slice(p.lastIndexOf('.'));

const server = http.createServer(async (req, res) => {
	const body = await new Promise((ok, bad) => {
		const chunks = [];
		createReadStream(file).on('data', (c) => chunks.push(c)).on('end', () => ok(Buffer.concat(chunks))).on('error', bad);
	});
	const etag = '"' + createHash('sha256').update(body).digest('hex').slice(0, 16) + '"';
	res.setHeader('cache-control', 'public, max-age=60'); // browser may reuse for 60s
	if (req.headers['if-none-match'] === etag) {
		res.writeHead(304, { etag }); // match: "reuse your copy" — no body
		res.end();
		return;
	}
	res.writeHead(200, { 'content-type': MIME[ext(file)], etag });
	res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const get = (headers = {}) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, headers }, (res) => {
		let bytes = 0, body = '';
		res.on('data', (c) => { bytes += c.length; body += c; });
		res.on('end', () => resolve({ status: res.statusCode, etag: res.headers.etag, cacheControl: res.headers['cache-control'], bytes, body }));
	}).on('error', reject);
});

// [1] first GET: full response with stamp + policy
{
	console.log('[1] first GET:');
	const r = await get();
	console.log(`  ${r.status}, body ${r.bytes} bytes, content-type ${MIME['.html']}`);
	console.log(`  etag: ${r.etag}, cache-control: ${r.cacheControl}`);
}

// [2] revalidate with the etag: 304, no body
{
	console.log('[2] re-GET with If-None-Match:');
	const first = await get();
	const r = await get({ 'if-none-match': first.etag });
	console.log(`  status ${r.status} — body bytes: ${r.bytes} (the 304 carries no body)`);
	console.log('  the browser reuses its cached copy; the wire only paid for headers');
}

// [3] stale etag: changed file, new hash, full 200
{
	console.log('[3] file changed since the etag:');
	const oldEtag = (await get()).etag;      // stamp of v1, BEFORE the change
	writeFileSync(file, '<h1>cached lesson v2</h1>');
	const r = await get({ 'if-none-match': oldEtag });
	console.log(`  sent old etag ${oldEtag}, file changed → ${r.status} with ${r.bytes} bytes of fresh body`);
	console.log(`  server etag now: ${r.etag} — the stamp moved with the content`);
}

console.log('--- key idea ---');
console.log('ETag = body stamp, Cache-Control = policy. 304 = "your copy is still good".');
await new Promise((r) => server.close(r));
