// Lesson 2-4 — CJS vs ESM internals: resolution, module cache, ESM loader.
//
// Expected output:
//
//   [1] require() returns the SAME exports object twice (module cache)
//   [2] deleting require.cache[...] forces a reload: fresh object
//   [3] circular require: partial exports (the half-built object)
//   [4] ESM circular: top-level read TDZ-throws; a read inside a function
//       called later works — bindings are LIVE, values resolve at call time
//
// CommonJS caches by resolved filename; ES modules link first, evaluate
// later, and export live bindings. Circulars break both — CJS truncates,
// ESM TDZ-throws — unless the read is deferred to call time.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
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

// [4] ESM circular import: let-bindings TDZ-throw exactly like CJS
// truncates — but reading them inside a FUNCTION called later works,
// because bindings are live: the function reads the CURRENT value.
console.log('[4] ESM circular import — TDZ at eval time, live at call time:');
writeFileSync(join(dir, 'a.mjs'), `
	import { readB } from './b.mjs';
	export let aValue = 'A';
	console.log('  [a.mjs] evaluating; readB() deferred:', typeof readB);
`);
writeFileSync(join(dir, 'b.mjs'), `
	import { aValue } from './a.mjs'; // circular edge
	export function readB() { return 'b sees aValue = ' + aValue; } // read at CALL time: live binding
	// reading aValue HERE (top level) would TDZ-throw — a.mjs has not run yet
`);
const root = join(dir, 'root.mjs');
writeFileSync(root, `
	const { readB } = await import('./b.mjs');
	await import('./a.mjs');
	console.log('  [root] readB() AFTER both modules evaluated:', readB());
	console.log('  — b.mjs read aValue live: no truncation, no TDZ, because the read happened at call time');
`);
await import(pathToFileURL(root).href);

console.log('--- key idea ---');
console.log('CJS: circular require hands one side a partial exports object (warning above).');
console.log('ESM: circular top-level reads TDZ-throw; deferred reads are live — design for the latter.');
