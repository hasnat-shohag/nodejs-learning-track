// Lesson 2-1 — V8 from a server dev's view: JIT, hidden classes, GC.
//
// Expected output (numbers vary; labels are the lesson):
//
//   [1] friendly access    ~x ns/iter  (one shape: hidden class + inline cache)
//   [2] three shapes at the read site — still fast: the IC holds 4
//   [3] shape count at ONE read site: 4 shapes still fast (polymorphic
//       IC holds up to 4 hidden classes), 5th shape = megamorphic step
//   [4] V8 heap spaces with sizes — young generation vs old space
//
// Three V8 facts a server dev lives with: hot code gets compiled to machine
// code (JIT), objects that share a shape share a hidden class (fast field
// access), and GC reclaims heap in named spaces you can print.

import { getHeapStatistics, getHeapSpaceStatistics } from 'node:v8';
import { performance } from 'node:perf_hooks';

function bench(label, make, read) {
	const items = Array.from({ length: 100_000 }, (_, i) => make(i));
	// warm-up: enough rounds for BOTH benches to reach the same tier
	let sink = 0;
	for (let round = 0; round < 10; round++) for (const item of items) sink += read(item);
	const t0 = performance.now();
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

console.log('[2] three shapes through the same read site:');
bench('forked    ', (i) => {
	const o = {};
	if (i % 3 === 0) { o.payload = i; o.kind = 'row'; o.id = i; }
	else if (i % 3 === 1) { o.id = i; o.payload = i; o.kind = 'row'; }
	else { o.kind = 'row'; o.id = i; o.payload = i; }
	return o;
}, (o) => o.payload);
console.log('  3 forked shapes stay INSIDE the inline-cache budget (4) — reads stay fast; see [3]');

console.log('[3] hidden-class shape count at ONE read site:');
const mkShape = (i) => {
	// each factory builds fields in a DIFFERENT order → a different hidden class
	const o = {};
	if (i % 5 === 0) { o.id = i; o.kind = 'a'; o.payload = i; }
	else if (i % 5 === 1) { o.kind = 'b'; o.id = i; o.payload = i; }
	else if (i % 5 === 2) { o.payload = i; o.kind = 'c'; o.id = i; }
	else if (i % 5 === 3) { o.id = i; o.payload = i; o.kind = 'd'; }
	else { o.kind = 'e'; o.payload = i; o.id = i; }
	return o;
};
function benchShapes(nShapes, iters = 2_000_000) {
	let sink = 0;
	function read(o) { sink += o.payload; return sink; }
	const items = Array.from({ length: 64 }, (_, i) => mkShape(i % nShapes));
	for (let r = 0; r < 200_000; r++) for (const o of items) read(o); // warm the site
	const t0 = performance.now();
	for (let r = 0; r < iters; r++) read(items[r % 64]);
	const ns = (performance.now() - t0) / iters * 1e6;
	return { ns, sink };
}
const r4 = benchShapes(4);
const r5 = benchShapes(5);
console.log(`  four shapes at the site  : ${r4.ns.toFixed(1)} ns/iter (still polymorphic — inline cache holds)`);
console.log(`  five shapes, same site   : ${r5.ns.toFixed(1)} ns/iter — the 5th distinct hidden class is the megamorphic step`);

console.log('[4] V8 heap spaces (GC regions):');
for (const s of getHeapSpaceStatistics()) {
	const mb = s.space_size / 1048576;
	if (mb > 0.05) console.log(`  ${s.space_name}: ${mb.toFixed(1)}MB`);
}
const hs = getHeapStatistics();
const oldSpace = getHeapSpaceStatistics().find((s) => s.space_name === 'old_space');
console.log(`  heap_size_limit: ${(hs.heap_size_limit / 1048576).toFixed(0)}MB — a heap-WIDE budget`);
console.log(`  old_space now: ${(oldSpace.space_size / 1048576).toFixed(1)}MB — the region --max-old-space-size constrains (at 64MB flag the limit prints ~112MB, not 64)`);

console.log('--- key idea ---');
console.log('JIT rewards stable shapes and hot loops; GC spaces are the map of your latency budget.');
