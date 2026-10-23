// Lesson 2-2 — Heap vs stack, --max-old-space-size, OOM diagnosis.
//
// Expected output:
//
//   [1] stack depth before RangeError: ~10-12k frames (V8 stack, not heap)
//   [2] heap stats before/after growth + heap_size_limit (a heap-wide budget)
//   [3] child with --max-old-space-size=64 dies: SIGABRT + OOM dump on stderr
//
// The stack holds frames and has a fixed depth limit; the heap holds objects
// and has a tunable size cap. Blowing the stack throws RangeError (catchable);
// blowing the heap kills the process (not catchable) — different failures,
// different diagnosis.

import { getHeapStatistics } from 'node:v8';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const MB = 1048576;

console.log('[1] stack: recursion depth until RangeError');
let depth = 0;
function dive() {
	depth++;
	dive();
}
try {
	dive();
} catch (err) {
	console.log(`  ${err.constructor.name}: "${err.message}" at depth ${depth}`);
	console.log('  stack frames are counted, not heap objects — catchable, per-thread, fixed by --stack-size');
}

console.log('[2] heap: a bounded growth sample (parent stays alive)');
const before = getHeapStatistics().used_heap_size / MB;
const bag = [];
for (let i = 0; i < 400_000; i++) bag.push({ id: i, payload: 'x'.repeat(64) });
console.log(`  used_heap ${before.toFixed(0)}MB → ${(getHeapStatistics().used_heap_size / MB).toFixed(0)}MB after 400k objects`);
console.log(`  heap limit here: ${(getHeapStatistics().heap_size_limit / MB).toFixed(0)}MB — growth itself does NOT throw`);

console.log('[3] child with 64MB cap, OOM exit:');
const child = `const bag=[]; while(true) bag.push({id:1,payload:'x'.repeat(4096)});`;
try {
	await run('node', ['--max-old-space-size=64', '-e', child], { maxBuffer: 1e7 });
	console.log('  child exited normally (unexpected)');
} catch (err) {
	const lines = (err.stderr ?? '').split('\n').filter(Boolean);
	const oom = lines.find((l) => l.includes('heap out of memory'));
	console.log(`  child signal: ${err.signal ?? 'none'} — heap exhaustion aborts the process, no exception to catch`);
	console.log(`  stderr says: ${oom ? '"JavaScript heap out of memory"' : '(no OOM line found)'}`);
	const gcLines = lines.filter((l) => l.includes('Last few GCs')).length;
	console.log(`  native frames: ${lines.filter((l) => /^\s+\d+:/.test(l)).length} (node::/v8:: symbols — allocation evidence is in the`);
	console.log(`  "Last few GCs" lines above them (${gcLines} found) — the stack is C++, not a JS throw site`);
}

console.log('--- key idea ---');
console.log('Stack overflow throws; heap exhaustion kills. Size the heap with --max-old-space-size,');
console.log('read the OOM dump — GC history names the pressure, the native trace names the allocator path.');
