// Lesson 2-5 — The native boundary: N-API addons, JS calling C++.
//
// Expected output:
//
//   [1] process.versions lists the native stack (napi: the N-API level supported)
//   [2] built-in addons already in your process: fs/crypto are C++ calls
//   [3] a JS -> native -> JS round trip, timed — several-fold, machine-dependent
//
// Node ships C++ inside every process; addons are how YOUR C++ joins it.
// N-API is the stable ABI contract so compiled addons survive Node upgrades.

import { getHeapStatistics } from 'node:v8';
import { pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';

const pbkdf2Async = promisify(pbkdf2);

console.log('[1] the native stack inside your process:');
const v = process.versions;
console.log(`  node ${v.node} — Node itself (JS core modules over a C++ layer)`);
console.log(`  v8 ${v.v8} — JS engine (C++)`);
console.log(`  uv ${v.uv} — event loop + thread pool (C)`);
console.log(`  zlib ${v.zlib}, openssl ${v.openssl} — vendored native deps`);
console.log(`  napi ${v.napi} — the N-API level this Node supports (addon ABI, see the pitfall)`);

console.log('[2] JS calling C++ right now (built-in addons):');
console.log('  pbkdf2 is C++: time it at two sizes —');
const small = await pbkdf2Async('pw', 'salt', 1, 32, 'sha256');
const big = await pbkdf2Async('pw', 'salt', 100_000, 32, 'sha256');
console.log(`  1 iteration : ${small.length}-byte key (native call ~microseconds)`);
console.log(`  100k iters : ${big.length}-byte key (same call, work done on the thread pool)`);

console.log('[3] the boundary cost: JS object passed to C++ and back;');
function jsRoundTrip(str) {
	// pure JS: comparable cheap work
	return str.length + str.charCodeAt(0);
}
const payload = 'x'.repeat(64);
function bench(fn) {
	let sink = 0;
	for (let w = 0; w < 200_000; w++) sink += fn(payload); // warm-up: let both tiers settle
	const t = performance.now();
	for (let i = 0; i < 1_000_000; i++) sink += fn(payload);
	return { ms: performance.now() - t, sink };
}
const js = bench(jsRoundTrip);
const native = bench((s) => Buffer.byteLength(s, 'utf8')); // crosses into C++
console.log(`  1M pure-JS calls : ${js.ms.toFixed(0)}ms`);
console.log(`  1M Buffer.byteLength (C++): ${native.ms.toFixed(0)}ms — several-fold slower, machine-dependent`);
console.log('  (byteLength on an existing Buffer view takes a fast path — measure YOUR call, not this number)');
console.log('  rule: batch work on one side rather than ping-pong across the boundary');

console.log('--- key idea ---');
console.log('Every built-in module you use IS the native boundary. N-API addons extend the');
console.log('same seam with a stable ABI — compile once, run across Node versions.');
