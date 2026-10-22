// Lesson 1-6 — Timers deep: ref/unref, nesting, setInterval drift.
//
// Expected output:
//
//   --- unref ≠ cancel ---
//   [1] unref-ed timer still fired (process was alive anyway)
//   [2] fired=true — unref only drops keep-alive, never cancels
//   --- exit: only unref-ed timer pending → process exits now ---
//   [3] child: "about to exit — timer pending, unref-ed" (and NO "never")
//   --- ref() restores keep-alive ---
//   [4] child: "waiting... | ran"
//   --- nesting: re-armed setTimeout runs on its own loop turn ---
//   [5] tick 1 / [6] tick 2 / [7] two separate turns, not recursion
//   --- setInterval drift under load ---
//   gaps like: 100 150 51 51 100 — block 150 > interval → catch-up burst
//
// ref/unref: unref removes keep-alive but a pending timer still fires if
// something else keeps the loop alive; ref restores it.

import { setTimeout as sleep } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

console.log('--- unref ≠ cancel ---');
let fired = false;
const stillFires = setTimeout(() => {
	fired = true;
	console.log('[1] unref-ed timer still fired (process was alive anyway)');
}, 50);
stillFires.unref();
await sleep(80);
console.log(`[2] fired=${fired} — unref only drops keep-alive, never cancels`);

console.log('--- exit: only unref-ed timer pending → process exits now ---');
const childA = "const t=setTimeout(()=>console.log('never'),50); t.unref(); console.log('about to exit — timer pending, unref-ed');";
const { stdout: outA } = await run('node', ['-e', childA]);
console.log(`[3] child: ${JSON.stringify(outA.trim())} — exited without waiting`);

console.log('--- ref() restores keep-alive ---');
const childB = "const t=setTimeout(()=>console.log('ran'),50); t.unref(); t.ref(); console.log('waiting...');";
const { stdout: outB } = await run('node', ['-e', childB]);
console.log(`[4] child: ${JSON.stringify(outB.trim())} — ref-ed timer held the loop open`);

console.log('--- nesting: re-armed setTimeout runs on its own loop turn ---');
let n = 0;
setTimeout(function tick() {
	n += 1;
	console.log(`[5] tick ${n}`);
	if (n < 2) setTimeout(tick, 30);
	else console.log('[7] two separate turns, not recursion');
}, 30);
await sleep(120);

console.log('--- setInterval drift under load ---');
const gaps = [];
let last = process.hrtime.bigint();
const iv = setInterval(() => {
	const now = process.hrtime.bigint();
	gaps.push(Number(now - last) / 1e6);
	last = now;
	if (gaps.length === 1) {
		const end = process.hrtime.bigint() + 150_000_000n; // 150ms block > 100ms interval
		while (process.hrtime.bigint() < end) {}
	}
	if (gaps.length >= 5) {
		clearInterval(iv);
		console.log('gaps (ms):', gaps.map((g) => g.toFixed(0)).join(' '));
		console.log('[8] 150ms block: one late fire, dues 2 missed and DROPPED — no catch-up burst');
		console.log('    missed dues never accumulate: a timer cannot fire more than once per loop turn');
	}
}, 100);
await sleep(700);
