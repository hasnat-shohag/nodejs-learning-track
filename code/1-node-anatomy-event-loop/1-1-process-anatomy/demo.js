// Lesson 1-1 — Node process anatomy.
//
// Expected output (numbers vary by your Node build):
//
//   node      v22.23.3
//   v8        12.x.x
//   uv        1.x.x
//   zlib      1.x.x
//   ...
//
// The three layers of a Node process, printed by the process itself:
// V8 (v8), libuv (uv), and Node's own bindings (node).

const { node, v8, uv, zlib, ...rest } = process.versions;

console.log('--- process.versions: the layers in one place ---');
console.log(`node (bindings + C++ core): ${node}`);
console.log(`v8   (JavaScript engine):  ${v8}`);
console.log(`uv   (libuv, event loop):   ${uv}`);
console.log(`zlib (native dependency):   ${zlib}`);
console.log(`others: ${Object.keys(rest).slice(0, 5).join(', ')}…`);

console.log('\n--- the process itself ---');
console.log(`execPath: ${process.execPath}`);
console.log(`platform/arch: ${process.platform} / ${process.arch}`);
console.log(`pid: ${process.pid}`);
console.log(`argv:`, process.argv);

console.log('\nOne process, three layers: your JS runs in V8, the event loop');
console.log('and async I/O live in libuv, and Node\'s C++ bindings join them.');
