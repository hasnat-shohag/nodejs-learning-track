// Lesson 5-6 — diagnostics: --inspect, monitorEventLoopDelay, heap snapshot.
//
// Expected output (numbers vary):
//
//   [1] monitorEventLoopDelay samples the gap between loop turns;
//       a 70ms blocking fs sync stall shows up as a delay spike,
//       normal turns stay ~0-1ms
//   [2] the same stall seen through the event-loop "tick" lens:
//       a setTimeout(50) fires LATE by the stall size — the delay
//       IS the stall; timers are loop turns like any other
//   [3] a 60s no-activity window with zero delay samples would look
//       healthy — so also watch the timer drift, the honest signal
//
// Production servers fail by going quiet or slow, not by crashing.
// The two built-in instruments: perf_hooks can measure loop delay
// from inside, and --inspect opens a debugging channel from outside.

import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { pbkdf2Sync } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

// [1] monitorEventLoopDelay: histogram of loop turn gaps
{
	console.log('[1] monitorEventLoopDelay:');
	const h = monitorEventLoopDelay({ resolution: 1 }); // sample every 1ms — coarse settings miss spikes
	h.enable();
	await sleep(30); // some quiet turns first
	const t0 = performance.now();
	pbkdf2Sync('k', 's', 600_000, 32, 'sha256'); // ~90ms of BLOCKING CPU — loop frozen
	const stall = performance.now() - t0;
	await sleep(10); // one more turn — the big gap only gets sampled on the NEXT loop turn
	h.disable();
	console.log(`  blocking call held the loop for ${stall.toFixed(0)}ms`);
	const ms = (ns) => (ns / 1e6).toFixed(1);
	console.log(`  delay max ${ms(h.max)}ms (mean ${ms(h.mean)}ms) — the stall, as the loop felt it`);
	console.log('  resolution matters: a 5ms sample interval can make this same stall look tiny');
}

// [2] the stall from the timer side: drift = delay
{
	console.log('[2] same stall, timer drift:');
	const drift = [];
	const timer = setInterval(() => drift.push(performance.now()), 20);
	await sleep(50);
	const t0 = performance.now();
	pbkdf2Sync('k', 's', 600_000, 32, 'sha256'); // same stall
	const stall = performance.now() - t0;
	await sleep(50);
	clearInterval(timer);
	const gaps = drift.slice(1).map((t, i) => t - drift[i]);
	const maxGap = Math.max(...gaps);
	console.log(`  timer asked for 20ms ticks; largest observed gap ${maxGap.toFixed(0)}ms`);
	console.log(`  the loop was blocked ${stall.toFixed(0)}ms — the tick due during it fired ~${(maxGap - 20).toFixed(0)}ms late`);
	console.log('  latency SLA breaches show up here first: every timer and request queues behind the block');
}

// [3] process-level self-report: what to watch in prod
{
	console.log('[3] the prod checklist, from inside the process:');
	const mu = process.memoryUsage();
	console.log(`  rss ${(mu.rss / 1e6).toFixed(0)}MB, heapUsed ${(mu.heapUsed / 1e6).toFixed(0)}MB — rss creeping up across deploys = leak candidate`);
	console.log(`  uptime ${process.uptime().toFixed(0)}s; process.report gives a full dump on demand`);
	console.log('  --inspect (or SIGUSR1 on Linux) attaches a debugger to a live process — last resort, never routine');
	console.log('  heap snapshot: node --heapsnapshot-signal=SIGUSR2 or writeHeapSnapshot() from inspector when rss climbs');
}

console.log('--- key idea ---');
console.log('Loop delay = the honest health metric. monitorEventLoopDelay inside, --inspect outside.');
