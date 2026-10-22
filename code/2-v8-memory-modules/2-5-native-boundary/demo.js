// Lesson 2-5 — The native boundary: N-API addons, JS calling C++.
//
// Expected output:
//
//   [1] process.versions lists the native stack (napi not versioned separately)
//   [2] built-in addons already in your process: fs/crypto are C++ calls
//   [3] a JS -> native -> JS round trip, timed: the boundary has a cost
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
console.log(`  node ${v.node} — bindings layer (C++)`);
console.log(`  v8 ${v.v8} — JS engine (C++)`);
console.log(`  uv ${v.uv} — event loop + thread pool (C)`);
console.log(`  zlib ${v.zlib}, openssl ${v.openssl} — vendored native deps`);

console.log('[2] JS calling C++ right now (built-in addons):');
console.log('  pbkdf2 is C++: time it at two sizes —');
const small = await pbkdf2Async('pw', 'salt', 1, 32, 'sha256');
const big = await pbkdf2Async('pw', 'salt', 100_000, 32, 'sha256');
console.log(`  1 iteration : ${small.length}-byte key (native call ~microseconds)`);
console.log(`  100k iters : ${big.length}-byte key (same call, work done on the thread pool)`);

console.log('[3] the boundary cost: JS object passed to C++ and back;');
function jsRoundTrip(str) {
	// pure JS: parse-ish work for comparison
	return str.length + str.charCodeAt(0);
}
const payload = 'x'.repeat(64);
const t0 = performance.now();
for (let i = 0; i < 1_000_000; i++) jsRoundTrip(payload);
const jsMs = performance.now() - t0;
const t1 = performance.now();
for (let i = 0; i < 1_000_000; i++) Buffer.byteLength(payload, 'utf8'); // crosses into C++
const nativeMs = performance.now() - t1;
console.log(`  1M pure-JS calls : ${jsMs.toFixed(0)}ms`);
console.log(`  1M Buffer.byteLength (C++): ${nativeMs.toFixed(0)}ms — each call crossed the boundary`);
console.log('  rule: batch work on one side rather than ping-pong across the boundary');

console.log('--- key idea ---');
console.log('Every built-in module you use IS the native boundary. N-API addons extend the');
console.log('same seam with a stable ABI — compile once, run across Node versions.');
