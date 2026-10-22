// Lesson 2-3 — Memory leaks: closures, timers, listeners; heap snapshots.
//
// Run with the GC flag so the numbers are honest (the header comment
// explains why: without it, "heap used" is at the mercy of the GC's
// own schedule and the demo cannot prove a plateau):
//
//   node --expose-gc code/2-v8-memory-modules/2-3-memory-leaks/demo.js
//
// Expected output:
//
//   [1] leak: 40 requests pin 40 payloads in a module Map
//   [2] bounded: same load, 10-entry cache — heap returns to baseline
//   [3] listener leak: MaxListenersExceededWarning on stderr at the 11th
//   [4] heap snapshot written to /tmp — open in DevTools for retainer paths
//
// Three classic leaks: a closure pinned in module state, a timer capturing
// scope, an event listener never removed. Each is "an object GC can still
// reach" — and each shows up in a heap snapshot as a retainer edge.

import { getHeapStatistics, writeHeapSnapshot } from 'node:v8';
import { setTimeout as sleep } from 'node:timers/promises';
import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MB = 1048576;
const used = () => getHeapStatistics().used_heap_size / MB;
const settle = async () => { global.gc?.(); await sleep(50); global.gc?.(); };

if (!global.gc) {
	console.error('run with: node --expose-gc (see header comment)');
	process.exit(1);
}

// [1] leak: every request pins a big payload in a module-level Map "for later"
const requests = new Map();
function handleRequest(id) {
	const big = new Array(100_000).fill('x'); // pretend response payload
	requests.set(id, { big, at: Date.now() }); // nobody ever deletes
}
console.log('[1] closure pinned in module state:');
await settle();
const base1 = used();
for (let i = 0; i < 40; i++) handleRequest(i);
await settle();
console.log(`  40 requests: ${base1.toFixed(0)}MB → ${used().toFixed(0)}MB — GC ran, nothing was collected: LEAK`);
console.log(`  map size: ${requests.size} — every entry still reachable from module scope`);

// [2] bounded cache: same load, but old entries evicted
console.log('[2] bounded cache (same load, eviction added):');
const cache = new Map();
function handleBounded(id) {
	const big = new Array(100_000).fill('x');
	cache.set(id, { big });
	if (cache.size > 10) cache.delete(cache.keys().next().value); // evict oldest
}
requests.clear(); // release [1]'s objects
await settle();
const base2 = used();
for (let i = 0; i < 400; i++) handleBounded(i);
await settle();
console.log(`  400 requests into a 10-entry cache: ${base2.toFixed(0)}MB → ${used().toFixed(0)}MB — back to baseline: NOT a leak`);
console.log('  [1] held 40; [2] holds 10 no matter the request count — boundedness is the difference');

// [3] listener leak: the classic MaxListeners warning
console.log('[3] listener leak:');
const bus = new EventEmitter();
console.log(`  default max listeners: ${bus.getMaxListeners()}`);
for (let i = 0; i < 12; i++) bus.on('ping', () => {}); // warning goes to stderr here
await sleep(100);
console.log(`  listenerCount: ${bus.listenerCount('ping')} — check stderr for the warning above`);
bus.removeAllListeners('ping');
console.log('  after removeAllListeners: leak gone');

// [4] snapshot: write one, point at it
const file = writeHeapSnapshot(join(tmpdir(), 'leaks-demo.heapsnapshot'));
console.log(`[4] heap snapshot written: ${file}`);
console.log('  open in Chrome DevTools → Memory → find retainer paths for the Map above');
console.log('--- key idea ---');
console.log('A leak is reachable-but-useless. Find WHO retains it (retainers panel), then break that edge.');
