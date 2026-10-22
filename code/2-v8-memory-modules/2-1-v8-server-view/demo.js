// Lesson 2-1 — V8 from a server dev's view: JIT, hidden classes, GC.
//
// Expected output (numbers vary; labels are the lesson):
//
//   [1] friendly access    ~x ns/iter  (one shape: hidden class + inline cache)
//   [2] scattered access    ~y ns/iter  (slower: shapes fork, cache misses)
//   [3] one shape at a call site vs four shapes — inline cache overflow
//   [4] V8 heap spaces with sizes — young generation vs old space
//
// Three V8 facts a server dev lives with: hot code gets compiled to machine
// code (JIT), objects that share a shape share a hidden class (fast field
// access), and GC reclaims heap in named spaces you can print.

import { getHeapStatistics, getHeapSpaceStatistics } from 'node:v8';
import { performance } from 'node:perf_hooks';

function bench(label, make, read) {
	const items = Array.from({ length: 100_000 }, (_, i) => make(i));
	// warm-up: let the JIT see the loop before timing (tiering at work)
	for (const item of items) read(item);
	const t0 = performance.now();
	let sink = 0;
	for (let round = 0; round < 20; round++) for (const item of items) sink += read(item);
	const ns = (performance.now() - t0) / (20 * items.length) * 1e6;
	console.log(`  ${label} ${ns.toFixed(1)} ns/iter (sink ${sink & 1})`);
}

function Friendly(i) {
	this.id = i;
	this.kind = 'row';
	this.payload = i * 3;
}

console.log('[1] one shape for all objects:');
bench('friendly  ', (i) => new Friendly(i), (o) => o.payload);

console.log('[2] a different shape every third object:');
bench('scattered ', (i) => {
	const o = {};
	if (i % 3 === 0) { o.payload = i; o.kind = 'row'; o.id = i; }
	else if (i % 3 === 1) { o.id = i; o.payload = i; o.kind = 'row'; }
	else { o.kind = 'row'; o.id = i; o.payload = i; }
	return o;
}, (o) => o.payload);

console.log('[3] megamorphic call sites kill inline caches:');
const shapes = [
	(i) => ({ id: i, kind: 'a', payload: i }),
	(i) => ({ kind: 'b', id: i, payload: i }),
	(i) => ({ payload: i, kind: 'c', id: i }),
	(i) => { const o = {}; o.id = i; o.kind = 'd'; o.payload = i * 2; return o; },
];
function monoCallSite() {
	const items = Array.from({ length: 400_000 }, (_, i) => shapes[0](i));
	const t0 = performance.now();
	let sink = 0;
	for (let round = 0; round < 10; round++) for (const o of items) sink += o.payload;
	return (performance.now() - t0) / (10 * items.length) * 1e6;
}
function megaCallSite() {
	// FOUR shapes rotate through the SAME read site: the inline cache
	// overflows and V8 falls back to a slow lookup every time.
	const items = Array.from({ length: 400_000 }, (_, i) => shapes[i % 4](i));
	const t0 = performance.now();
	let sink = 0;
	for (let round = 0; round < 10; round++) for (const o of items) sink += o.payload;
	return (performance.now() - t0) / (10 * items.length) * 1e6;
}
console.log(`  one shape at the read site : ${monoCallSite().toFixed(1)} ns/iter`);
console.log(`  four shapes, same site    : ${megaCallSite().toFixed(1)} ns/iter — inline cache gave up`);

console.log('[4] V8 heap spaces (GC regions):');
for (const s of getHeapSpaceStatistics()) {
	const mb = s.space_size / 1048576;
	if (mb > 0.05) console.log(`  ${s.space_name}: ${mb.toFixed(1)}MB`);
}
const hs = getHeapStatistics();
console.log(`  heap limit: ${(hs.heap_size_limit / 1048576).toFixed(0)}MB (--max-old-space-size caps old space)`);

console.log('--- key idea ---');
console.log('JIT rewards stable shapes and hot loops; GC spaces are the map of your latency budget.');
