// Lesson 5-5 — security hygiene: timing-safe compares, headers, path joins.
//
// Expected output:
//
//   [1] === on secrets leaks: timing a token check over 10k tries
//       shows early-exit behavior (mismatch position → time grows)
//   [2] crypto.timingSafeEqual: same comparisons, flat time —
//       no position signal to exploit
//   [3] security headers: one middleware line each, sent and shown
//   [4] path traversal: raw join escapes the webroot; the guard
//       (resolve + startsWith) blocks it
//
// The threats a plain server actually faces: timing side channels on
// secret compares, missing browser defenses (headers), and traversal
// in path-built routes. Each has a one-line defense — if you know it.

import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { performance } from 'node:perf_hooks';
import { join, resolve, sep } from 'node:path';

// [1] === leaks position of first mismatch
{
	console.log('[1] === on a secret (10,000 comparisons per position):');
	const real = Buffer.from('a9f3c2e8b7d1');
	// the classic early-exit compare: bail at the first differing byte
	const naive = (a, b) => {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
		return true;
	};
	let sink = 0; // defeat dead-code elimination: the compare must matter
	const time = (guess) => {
		const g = Buffer.from(guess);
		const t0 = performance.now();
		for (let i = 0; i < 10_000; i++) sink += naive(g, real) ? 1 : 0;
		return performance.now() - t0;
	};
	const wrongFirst = time('zzzzzzzzzzzz'); // differs at byte 0
	const wrongLast = time('a9f3c2e8b7dz'); // differs at byte 11
	console.log(`  mismatch at byte 0 : ${wrongFirst.toFixed(1)}ms`);
	console.log(`  mismatch at byte 11: ${wrongLast.toFixed(1)}ms`);
	console.log(`  early-exit compare — the longer-prefix guess took ${((wrongLast / wrongFirst - 1) * 100).toFixed(0)}% longer`);
	console.log('  an attacker measuring that gradient learns the token one byte at a time');
}

// [2] timingSafeEqual: flat
{
	console.log('[2] crypto.timingSafeEqual (same 10,000):');
	const real = Buffer.from('a9f3c2e8b7d1');
	let sink2 = 0;
	const time = (guess) => {
		const g = Buffer.from(guess);
		const t0 = performance.now();
		for (let i = 0; i < 10_000; i++) sink2 += timingSafeEqual(g, real) ? 1 : 0;
		return performance.now() - t0;
	};
	const wrongFirst = time('zzzzzzzzzzzz');
	const wrongLast = time('a9f3c2e8b7dz');
	console.log(`  mismatch at char 0 : ${wrongFirst.toFixed(1)}ms`);
	console.log(`  mismatch at char 11: ${wrongLast.toFixed(1)}ms`);
	console.log('  flat — no position gradient, nothing to measure');
	// note: timingSafeEqual throws on length mismatch, check length first
	try {
		timingSafeEqual(Buffer.from('short'), real);
	} catch (e) {
		console.log(`  length mismatch throws (${e.message.slice(0, 30)}...) — compare lengths first, never leak via the throw`);
	}
}

// [3] security headers, one line each
{
	console.log('[3] security headers:');
	const server = http.createServer((req, res) => {
		res.setHeader('x-content-type-options', 'nosniff');
		res.setHeader('x-frame-options', 'DENY');
		res.setHeader('strict-transport-security', 'max-age=31536000');
		res.setHeader('content-security-policy', "default-src 'self'");
		res.end('ok');
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const res = await new Promise((resolve, reject) => {
		http.get({ host: '127.0.0.1', port: server.address().port }, resolve).on('error', reject);
	});
	for (const h of ['x-content-type-options', 'x-frame-options', 'strict-transport-security', 'content-security-policy']) {
		console.log(`  ${h}: ${res.headers[h]}`);
	}
	await new Promise((r) => server.close(r));
	console.log('  four lines: no MIME sniffing, no framing, no http-downgrade, no rogue scripts');
}

// [4] path traversal
{
	console.log('[4] path traversal:');
	const webroot = '/var/www/site';
	const unsafe = (p) => join(webroot, p);
	const safe = (p) => {
		const full = resolve(webroot, '.' + sep + p);
		if (!full.startsWith(webroot + sep)) return null;
		return full;
	};
	console.log(`  join(root, 'img/cat.png')      → ${unsafe('img/cat.png')}`);
	console.log(`  join(root, '../../etc/passwd')  → ${unsafe('../../etc/passwd')} — ESCAPED the webroot`);
	console.log(`  guarded resolve('../../etc/passwd') → ${safe('../../etc/passwd')} — blocked (null)`);
	console.log('  resolve + startsWith before any fs call; decode BEFORE guarding (encoded dots count too)');
}

console.log('--- key idea ---');
console.log('timingSafeEqual for secrets, headers for the browser, resolve+startsWith for paths.');
