// Lesson 2-4 — CJS vs ESM internals: resolution, module cache, ESM loader.
//
// Expected output:
//
//   [1] require() returns the SAME exports object twice (module cache)
//   [2] deleting require.cache[...] forces a reload: fresh object
//   [3] circular require: partial exports (the half-built object)
//   [4] ESM circular: top-level read TDZ-throws ONLY when the reader
//       module evaluates before the exporter; entered the other way the
//       same read works. A read inside a function called later works in
//       both orders — bindings are LIVE, values resolve at call time
//
// CommonJS caches by resolved filename; ES modules link first, evaluate
// later, and export live bindings. Circulars break both — CJS truncates,
// ESM TDZ-throws on reader-first order — unless the read is deferred to
// call time.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const dir = join(tmpdir(), `mod-internals-${process.pid}`);
mkdirSync(dir, { recursive: true });
const cleanup = () => rmSync(dir, { recursive: true, force: true });
process.on('exit', cleanup);

// [1] cache: two require() calls, one object
console.log('[1] require() module cache:');
writeFileSync(join(dir, 'counter.cjs'), 'module.exports = { n: 0 };\n');
const a = require(join(dir, 'counter.cjs'));
const b = require(join(dir, 'counter.cjs'));
console.log(`  a === b: ${a === b} — second require returns the cached exports`);
a.n = 99;
console.log(`  after a.n = 99: b.n = ${b.n} — one object, mutated state is shared`);

// [2] cache eviction: delete and require again
console.log('[2] cache eviction (require.cache):');
delete require.cache[require.resolve(join(dir, 'counter.cjs'))];
const c = require(join(dir, 'counter.cjs'));
console.log(`  after delete + require: c.n = ${c.n}, c === a: ${c === a} — fresh load, state reset`);

// [3] circular require: one side sees a partial exports object
console.log('[3] circular require — partial exports:');
writeFileSync(join(dir, 'first.cjs'), `
	const second = require('./second.cjs');
	module.exports = { firstValue: 'F' };
	console.log('  [first.cjs] sees second.secondValue =', second.secondValue);
`);
writeFileSync(join(dir, 'second.cjs'), `
	const first = require('./first.cjs');
	module.exports = { secondValue: 'S' };
	console.log('  [second.cjs] sees first.firstValue =', first.firstValue, '(undefined: partial exports)');
`);
require(join(dir, 'first.cjs'));

// [4] ESM circular import: whether a top-level read TDZ-throws depends on
// WHICH module evaluates first — the reader or the exporter. Enter the cycle
// from the reader (b): a evaluates first, b's top-level read works. Enter
// from a: b's top-level read runs while aValue is still in TDZ → throws.
// A read inside a FUNCTION called later works in both orders — bindings are
// LIVE, values resolve at call time. Each entry runs in its OWN child node
// process: the module cache of this demo process would otherwise make the
// second entry see the cycle already evaluated.
console.log('[4] ESM circular import — TDZ depends on eval order; deferred reads are live:');
writeFileSync(join(dir, 'a.mjs'), `
	import { readB } from './b.mjs';
	export let aValue = 'A';
	console.log('  [a.mjs] evaluated, aValue =', aValue);
`);
writeFileSync(join(dir, 'b.mjs'), `
	import { aValue } from './a.mjs'; // circular edge
	export function readB() { return 'b sees aValue = ' + aValue; } // read at CALL time: live binding
	console.log('  [b.mjs] top-level read of aValue:', aValue); // TDZ only if b evaluates FIRST
`);
const runNode = async (arg) => {
	try {
		const { stdout } = await promisify(execFile)('node', [arg], { cwd: dir });
		return { ok: true, out: stdout.trim() };
	} catch (err) {
		return { ok: false, out: err.stderr.split('\n')[0] };
	}
};
writeFileSync(join(dir, 'viaB.mjs'), `await import('./b.mjs');`); // b → a → back to b: a ran first, no TDZ
writeFileSync(join(dir, 'viaA.mjs'), `await import('./a.mjs');`); // a → b → back to a: b runs first, TDZ
const rB = await runNode('viaB.mjs');
console.log(rB.out);
console.log('  → entered via b: a evaluated first, top-level read fine — no TDZ');
const rA = await runNode('viaA.mjs');
console.log('  → entered via a: ReferenceError:', rA.out.slice(0, 48) + '…');
console.log('    reader evaluated before exporter → the binding was still in TDZ');
// deferred read works regardless of entry order
writeFileSync(join(dir, 'deferred.mjs'), `
	const { readB } = await import('./b.mjs');
	await import('./a.mjs');
	console.log('  [deferred] readB() AFTER both evaluated:', readB());
`);
const rD = await runNode('deferred.mjs');
console.log(rD.out);
console.log('  — call-time read: no truncation, no TDZ, the binding was live');

console.log('--- key idea ---');
console.log('CJS: circular require hands one side a partial exports object (warning above).');
console.log('ESM: a top-level circular read TDZ-throws only when the reader evaluates first;');
console.log('     deferred reads are live in every order — design for the latter.');
