// Lesson 3-6 — child_process: spawn vs fork vs exec, IPC, signals.
//
// Expected output (pids vary; the shape is the lesson):
//
//   [1] spawn: streams — stdout/stderr arrive as Readable streams,
//       data flows while the child runs (no waiting for exit)
//   [2] fork = spawn + Node + IPC channel: parent.send ↔ child
//       process.send, JSON-serialized messages each way (the fork default)
//   [3] exec: ONE shell string, buffered, maxBuffer cap;
//       execFile: argv array, no shell — "&&" stays literal
//   [4] signals: kill(SIGTERM) → exit event fires with
//       { code: null, signal: 'SIGTERM' } — signal, not exit code
//
// Choosing: spawn for big/streaming output, fork for Node-to-Node
// with messaging, exec for quick shell one-liners, execFile when the
// command is fixed and input must not be shell-interpreted.

import { spawn, fork, exec, execFile } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pid } from 'node:process';

console.log(`[1] spawn: streams (parent pid ${pid})`);
{
	const child = spawn(process.execPath, ['-e', `
		for (let i = 1; i <= 3; i++) {
			console.log('chunk ' + i);
			await new Promise((r) => setTimeout(r, 50));
		}
	`], { stdio: ['ignore', 'pipe', 'pipe'] });
	let seen = 0;
	child.stdout.on('data', (c) => {
		seen++;
		process.stdout.write(`  parent sees line ${seen} as it lands: ${c}`);
	});
	await new Promise((r) => child.on('exit', r));
	console.log(`  3 chunks streamed in, arrival spread over time — not one buffered blob`);
}

console.log('[2] fork = spawn + Node + IPC channel:');
{
	const childFile = join(tmpdir(), `lesson-child-${pid}.cjs`);
	writeFileSync(childFile, `
		process.on('message', (m) => {
			if (m.kind === 'ping') process.send({ kind: 'pong', got: m.n, childPid: process.pid });
		});
	`);
	const child = fork(childFile, { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
	const reply = await new Promise((r) => { child.once('message', r); child.send({ kind: 'ping', n: 42 }); });
	console.log(`  parent sent { kind: 'ping', n: 42 } → child replied ${JSON.stringify(reply)}`);
	console.log('  channel = JSON-serialized messages both ways (fork default; serialization: advanced opts into structured clone)');
	child.kill();
	await new Promise((r) => child.on('exit', r));
	rmSync(childFile, { force: true });
}

console.log('[3] exec vs execFile:');
{
	const { promisify } = await import('node:util');
	const execAsync = promisify(exec);
	const execFileAsync = promisify(execFile);
	const sh = await execAsync('echo hello && echo $0');
	console.log(`  exec('echo hello && echo $0') → ${JSON.stringify(sh.stdout.trim())} — shell ran BOTH commands`);
	const literal = await execFileAsync('echo', ['hello && echo $0']);
	console.log(`  execFile('echo', ['hello && echo $0']) → ${JSON.stringify(literal.stdout.trim())} — argv literal, no shell`);
}

console.log('[4] signals:');
{
	const child = spawn(process.execPath, ['-e', 'setTimeout(() => console.log("alive"), 5000)']);
	await sleep(150); // let the child arm its timer
	child.kill('SIGTERM');
	const exit = await new Promise((r) => child.on('exit', (code, signal) => r({ code, signal })));
	console.log(`  child.kill('SIGTERM') → exit event { code: ${exit.code}, signal: '${exit.signal}' }`);
	console.log('  signal ≠ exit code: a signaled death has code null — check .signal before .code');
}
console.log('--- key idea ---');
console.log('spawn streams, fork talks (IPC), exec shells one string, execFile argv-literal.');
console.log('Signaled child exits with code null + signal name — never read as success.');
