// Lesson 5-1 — Buffers and binary: bytes in, bytes out.
//
// Expected output:
//
//   [1] Buffer = bytes, not chars: utf8 'হাই' is 3 chars / 9 bytes,
//       hex shows the raw UTF-8; buffer.toJSON() gives the byte list
//   [2] Buffer is a Uint8Array subclass sharing an ArrayBuffer —
//       TypedArray view semantics, zero-copy subarray
//   [3] encodings matter: same bytes, three decodings, three results
//   [4] gotchas: slice aliasing (mutate one, see both), implicit
//       UTF-8 on write, and Buffer.alloc vs allocUnsafe
//
// JS strings are chars; networks and disks speak bytes. Buffer is the
// bridge: fixed-length byte array + encoding helpers. Server work —
// request bodies, files, crypto, protocol headers — is Buffer work.

import { Buffer } from 'node:buffer';

// [1] bytes vs chars
{
	console.log('[1] bytes, not chars:');
	const b = Buffer.from('হাই', 'utf8');
	console.log(`  'হাই'.length = ${'হাই'.length} chars, Buffer.byteLength = ${Buffer.byteLength('হাই')} bytes`);
	console.log(`  buffer hex: ${b.toString('hex')} — the raw UTF-8 on the wire`);
	console.log(`  toJSON: first bytes are ${b.toJSON().data.slice(0, 3).join(', ')} (each Bangla char starts 0xE0-0xE7)`);
}

// [2] Buffer is a Uint8Array over an ArrayBuffer
{
	console.log('[2] the inheritance and the view:');
	const ab = new ArrayBuffer(8);
	const u8 = new Uint8Array(ab);
	const buf = Buffer.from(ab); // same memory, Buffer API
	u8[0] = 255;
	console.log(`  Uint8Array and Buffer share one ArrayBuffer: buf[0] = ${buf[0]} (via the u8 write)`);
	const sub = buf.subarray(0, 4); // view, not copy
	sub[1] = 9;
	console.log(`  subarray aliases: parent[1] = ${buf[1]} after writing through the sub`);
}

// [3] encodings
{
	console.log('[3] same bytes, three decodings:');
	const raw = Buffer.from('হাই', 'utf8'); // 9 bytes of UTF-8
	console.log(`  utf8 : '${raw.toString('utf8')}' (the intended Bangla)`);
	console.log(`  latin1: '${raw.toString('latin1')}' (mojibake — bytes read as single-byte chars)`);
	console.log(`  hex  : ${raw.toString('hex')}`);
	console.log('  wrong decode never throws — it silently gives wrong text. Pick the encoding deliberately.');
}

// [4] gotchas
{
	console.log('[4] gotchas:');
	const a = Buffer.from('hello world');
	const alias = a.subarray(0, 5);
	alias.write('HELLO');
	console.log(`  subarray/slice ALIAS: a now starts '${a.toString('utf8').slice(0, 5)}' — not a copy`);
	const fresh = Buffer.alloc(4);      // zero-filled, safe
	const risky = Buffer.allocUnsafe(4); // pooled memory: contents UNDEFINED until written
	console.log(`  Buffer.alloc(4): [${fresh.toJSON().data}] — guaranteed zeroed; allocUnsafe(4): [${risky.toJSON().data}] — undefined contents, zeroed THIS run but not promised`);
	console.log('  use allocUnsafe only when you immediately overwrite every byte (it is an optimization, not a default)');
	risky.fill(0);
}

console.log('--- key idea ---');
console.log('Buffer = bytes + encoding helpers over an ArrayBuffer. Slice = alias. Decode = choose.');
