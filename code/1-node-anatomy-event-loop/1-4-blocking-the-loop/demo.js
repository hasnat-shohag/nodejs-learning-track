// Lesson 1-4 — Blocking the loop: cost model + event-loop lag.
//
// Expected output (times vary; the SHAPE is the lesson):
//
//   probe gaps (ms): 50 50 50 ... 209 ... 50   <- sync block spikes one gap
//   probe gaps (ms): 50 50 50 50 50 50 50 50   <- async work: no spike
//
// A 50ms probe ping measures event-loop lag directly: any callback that
// blocks the thread shows up as one gap that grows by the block time.

const gaps = [];
let last = process.hrtime.bigint();

const probe = setInterval(() => {
  const now = process.hrtime.bigint();
  gaps.push(Number(now - last) / 1e6);
  last = now;
}, 50);

function syncWork(ms) {
  const end = process.hrtime.bigint() + BigInt(ms) * 1_000_000n;
  while (process.hrtime.bigint() < end) {} // hot spin on the only thread
}

function asyncWork(ms) {
  // same wall-clock work, but chunked with setImmediate: the loop
  // keeps draining probes between chunks
  const end = process.hrtime.bigint() + BigInt(ms) * 1_000_000n;
  return new Promise((resolve) => {
    (function spin() {
      const slice = process.hrtime.bigint();
      while (process.hrtime.bigint() - slice < 5_000_000n) {} // 5ms slice
      if (process.hrtime.bigint() < end) setImmediate(spin);
      else resolve();
    })();
  });
}

setTimeout(() => {
  syncWork(200);
}, 260); // inside one probe window: one gap ~ 50+200

setTimeout(async () => {
  await asyncWork(200);
}, 1200);

setTimeout(() => {
  clearInterval(probe);
  const fmt = (list) => list.map((g) => g.toFixed(0)).join(' ');
  console.log('--- event-loop lag as probe gaps ---');
  console.log(`sync 200ms block: ${fmt(gaps.slice(0, 9))}   <- one gap eats the block`);
  console.log(`   async 200ms work: ${fmt(gaps.slice(9))}   <- no spike; loop kept serving`);
  console.log('--- cost model ---');
  console.log('Lag is not "slow code" — it is slow code ON THE ONLY THREAD.');
  console.log('The blocked duration is paid by EVERY pending callback, once.');
}, 2200);
