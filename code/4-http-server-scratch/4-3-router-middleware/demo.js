// Lesson 4-3 — hand-rolled router and middleware chain, no frameworks.
//
// Expected output:
//
//   [1] route table: exact match + params (/users/:id) — the whole
//       "framework router" is a loop and a regex
//   [2] middleware chain: logging → auth → handler; early finish
//       (401) skips the rest of the chain
//   [3] 404 is just "no route matched" — the fallthrough case
//
// A router is method+path matching. Middleware is functions in a row,
// each able to end the request early or call next(). Express did not
// invent these ideas — it packaged them. 30 lines get you both.

import http from 'node:http';

// --- the router: table of [method, pattern, handler] ---
const routes = [];
const parsePattern = (pattern) => {
	const keys = [];
	const regex = new RegExp('^' + pattern.replace(/:([A-Za-z]+)/g, (_, k) => {
		keys.push(k);
		return '([^/]+)';
	}) + '/?$');
	return { regex, keys };
};
const route = (method, pattern, handler) => {
	const { regex, keys } = parsePattern(pattern);
	routes.push({ method, regex, keys, handler });
};
const match = (method, pathname) => {
	for (const r of routes) {
		if (r.method !== method) continue;
		const m = r.regex.exec(pathname);
		if (!m) continue;
		const params = {};
		r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
		return { handler: r.handler, params };
	}
	return null;
};

// --- the middleware chain ---
const pipeline = [];
const use = (fn) => pipeline.push(fn);
const runPipeline = (req, res, final) => {
	let i = 0;
	const next = () => {
		if (res.writableEnded) return; // someone ended early
		if (i >= pipeline.length) { final(); return; }
		pipeline[i++](req, res, next);
	};
	next();
};

// --- assemble the app ---
use((req, res, next) => {
	console.log(`  mw[log] ${req.method} ${req.url}`);
	next();
});
const authorized = new Set(['token-a', 'token-b']);
use((req, res, next) => {
	if (req.url === '/health') { next(); return; } // public route skips auth
	const token = (req.headers.authorization ?? '').replace('Bearer ', '');
	if (!authorized.has(token)) {
		res.writeHead(401, { 'content-type': 'text/plain' });
		res.end('unauthorized');
		return; // early finish: chain stops here
	}
	req.user = { name: 'dev' };
	next();
});

route('GET', '/health', (req, res) => {
	res.writeHead(200, { 'content-type': 'text/plain' });
	res.end('healthy');
});
route('GET', '/users/:id', (req, res) => {
	res.writeHead(200, { 'content-type': 'application/json' });
	res.end(JSON.stringify({ userId: req.params.id, as: req.user.name }));
});
route('POST', '/users', (req, res) => {
	res.writeHead(201, { 'content-type': 'text/plain' });
	res.end('created');
});

const app = http.createServer((req, res) => {
	const parsed = new URL(req.url, `http://${req.headers.host}`);
	req.params = {};
	const found = match(req.method, parsed.pathname);
	if (!found) {
		res.writeHead(404, { 'content-type': 'text/plain' });
		res.end('not found');
		return;
	}
	Object.assign(req.params, found.params);
	runPipeline(req, res, () => found.handler(req, res));
});
await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
const port = app.address().port;

const call = (method, path, headers = {}) => new Promise((resolve, reject) => {
	const r = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
		let b = '';
		res.on('data', (c) => { b += c; });
		res.on('end', () => resolve({ status: res.statusCode, body: b }));
	});
	r.on('error', reject);
	r.end();
});

// [1] routing: exact, param, decoded params (token so auth lets us through)
const authHeader = { authorization: 'Bearer token-a' };
console.log('[1] route table:');
console.log('  GET /health      →', (await call('GET', '/health')).status);
const u = await call('GET', '/users/42', authHeader);
console.log(`  GET /users/42    → ${u.status} ${u.body} (param extracted)`);
console.log('  GET /users/a%20b →', (await call('GET', '/users/a%20b', authHeader)).body, '(decoded)');

// [2] middleware: log runs, auth rejects bad token, passes good
console.log('[2] middleware chain (watch log lines above):');
const denied = await call('GET', '/users/1');
console.log(`  no token     → ${denied.status} ${denied.body} — chain stopped at auth`);
const ok = await call('GET', '/users/1', { authorization: 'Bearer token-a' });
console.log(`  good token   → ${ok.status} ${ok.body} — log → auth → handler ran`);

// [3] 404 fallthrough
const missing = await call('GET', '/nope');
console.log(`[3] GET /nope → ${missing.status} — no route matched, that IS the 404`);

console.log('--- key idea ---');
console.log('Router = loop + regex. Middleware = array + next(). Everything else is packaging.');
await new Promise((resolve) => app.close(resolve));
