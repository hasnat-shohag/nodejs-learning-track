// Lesson 1-3 — Microtask ordering: nextTick vs Promise vs setImmediate.
//
// Expected output:
//
//   [0] sync code first
//   [1] nextTick A
//   [2] nextTick B (same queue, FIFO)
//   [3] Promise A (both nextTick queues are empty now)
//   [4] Promise B
//   [6] Promise C
//   [7] await continuation (an awaited promise resumes like any other)
//   [5] nextTick C (queued during Promise A — runs only after the promise queue drains)
//   [8] timeout (timers phase)
//   [9] immediate (check phase)
//
// The rules this demo pins down:
//   1. The nextTick queue drains completely before the Promise queue starts.
//   2. Once promise callbacks start, the whole promise queue drains — a
//      nextTick queued mid-drain waits until the queue is empty.
//   3. Both queues drain again after [5]; only then do the loop phases run.
//   4. setTimeout vs setImmediate at top level: nondeterministic — never rely on it.

console.log('[0] sync code first');
// Everything queues from INSIDE an immediate: at top level (ESM) the
// module body itself is an async context and the promise queue drains
// before nextTick — queueing from a callback shows the textbook order.
setImmediate(() => {
  process.nextTick(() => console.log('[1] nextTick A'));
  process.nextTick(() => console.log('[2] nextTick B (same queue, FIFO)'));
  Promise.resolve().then(() => {
    console.log('[3] Promise A (both nextTick queues are empty now)');
    process.nextTick(() => console.log('[5] nextTick C (queued during Promise A — runs only after the promise queue drains)'));
  });
  Promise.resolve().then(() => console.log('[4] Promise B'));
  Promise.resolve().then(() => console.log('[6] Promise C'));
  async function f() {
    await null;
    console.log('[7] await continuation (an awaited promise resumes like any other)');
  }
  f();
  setTimeout(() => console.log('[8] timeout (timers phase)'), 0);
  setImmediate(() => console.log('[9] immediate (check phase)'));
});
process.on('exit', () => console.log('[exit] microtask queues drained before every phase'));
