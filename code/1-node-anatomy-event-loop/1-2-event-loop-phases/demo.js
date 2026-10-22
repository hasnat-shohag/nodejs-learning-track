// Lesson 1-2 — Event loop phases.
//
// Expected output:
//
//   [timers]    setTimeout 0
//   [check]     setImmediate
//   [poll data] fs.readFileSync event: file read complete
//   [close]     watcher closed
//   ...
//
// Watch one loop turn through its phases: timers fire, the poll phase
// sees I/O, check runs setImmediate, and close callbacks run last.

import { readFileSync } from 'node:fs';

console.log('--- one loop turn, four phases ---');
setTimeout(() => console.log('[timers]    setTimeout 0'), 0);
setImmediate(() => console.log('[check]     setImmediate'));

// A real I/O op: the poll phase must notice it.
import('node:fs').then((fs) => {
  fs.readFile(new URL(import.meta.url), () => {
    console.log('[poll data] fs.readFile event: file read complete');
    // From inside a poll callback, immediate beats the next timer.
    setImmediate(() => console.log('[check]     setImmediate nested (queued during poll)'));
    setTimeout(() => console.log('[timers]    setTimeout nested (queued during poll)'), 0);
  });
});

const watcher = setInterval(() => {}, 1000);
watcher.close();
process.on('exit', () => console.log('[exit]      event loop empty, process exits'));
