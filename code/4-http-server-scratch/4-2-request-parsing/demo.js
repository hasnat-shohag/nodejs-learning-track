// Lesson 4-2 — request parsing: URL, headers, body as a stream.
//
// Expected output:
//
//   [1] new URL(req.url, base) splits path from query — searchParams
//       gives decoded values
//   [2] headers arrive lower-cased, string or string[] (set-cookie
//       is the array case)
//   [3] the body is a Readable: chunks arrive as they are sent,
//       content-length is bytes not chars
//   [4] JSON body the disciplined way: collect chunks, Buffer.concat,
//       JSON.parse once — and reject oversized bodies before parsing
//
// req.url is NOT a full URL — it is path+query only (no host, no scheme).
// Host lives in req.headers.host. Bodies do not arrive parsed: req is a
// stream and "reading the body" is your job.

import http from 'node:http';

const server = http.createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

// [1] URL: path, query, decoded params
const echo = [];
const app = http.createServer((req, res) => {
	// req.url: path + query, host lives in headers
	const full = `http://${req.headers.host}${req.url}`;
	const parsed = new URL(req.url, full);
	const body = [];
	req.on('data', (c) => body.push(c));
	req.on('end', () => {
		echo.push({
			path: parsed.pathname,
			q: parsed.searchParams.get('name'),
			host: req.headers.host,
			setCookieCount: (req.headers['set-cookie'] ?? []).length,
			bodyBytes: Buffer.concat(body).length,
		});
		res.end('ok');
	});
});
await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
const appPort = app.address().port;

// [2]+[3]: one request with query + array header + utf8 body
await new Promise((resolve, reject) => {
	const req = http.request(
		{
			host: '127.0.0.1', port: appPort, path: '/items?name=%E0%A6%B9%E0%A6%BE%E0%A6%87',
			method: 'POST', headers: { 'set-cookie': ['a=1', 'b=2'] },
		},
		(res) => { res.resume(); res.on('end', resolve); },
	);
	req.on('error', reject);
	req.end('হাই'); // 3 chars = 9 UTF-8 bytes (each Bangla char is 3 bytes)
});
const got = echo[0];
console.log('[1] path+query split (req.url has no host):');
console.log(`  path=${got.path} — query "name" decoded: ${got.q}`);
console.log('[2] headers:');
console.log(`  host header carries the host: ${got.host}`);
console.log(`  duplicate set-cookie → array of ${got.setCookieCount} (set-cookie is always an array)`);
console.log(`[3] body bytes: ${got.bodyBytes} for "হাই" — 3 chars, 9 UTF-8 bytes; byte length ≠ char count`);

// [4] size-guarded body read: the pattern to steal
{
	const guarded = http.createServer((req, res) => {
		const MAX = 16; // absurdly small for the demo
		let size = 0;
		const chunks = [];
		req.on('data', (c) => {
			size += c.length;
			if (size > MAX) {
				res.writeHead(413, { 'content-type': 'text/plain' });
				res.end('payload too large');
				req.destroy(); // stop the upload
				return;
			}
			chunks.push(c);
		});
		req.on('end', () => {
			if (size > MAX) return;
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ received: size }));
		});
	});
	await new Promise((resolve) => guarded.listen(0, '127.0.0.1', resolve));
	const gPort = guarded.address().port;
	const send = (body) => new Promise((resolve, reject) => {
		const r = http.request({ host: '127.0.0.1', port: gPort, method: 'POST' }, (res) => {
			res.resume();
			res.on('end', () => resolve(res.statusCode));
		});
		r.on('error', reject);
		r.end(body);
	});
	const small = await send('short');
	const big = await send('x'.repeat(40));
	console.log(`[4] size-guarded body read: 5 bytes → ${small}, 40 bytes → ${big} (guard fired, upload cut)`);
	await new Promise((resolve) => guarded.close(resolve));
}
console.log('--- key idea ---');
console.log('req.url is path+query; host is a header; body is a stream you must read and bound.');
server.close();
app.close();
