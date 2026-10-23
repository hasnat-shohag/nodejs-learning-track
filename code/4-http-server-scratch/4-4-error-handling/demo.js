// Lesson 4-4 — error handling that survives real traffic.
//
// Expected output:
//
//   [1] sync throw in a handler: try/catch around the handler
//       turns it into a 500 — process stays alive
//   [2] async throw (rejected promise): .catch() is the only net
//       — without it the process DIES (unhandled rejection)
//   [3] uncaughtException: process-level last resort — log and
//       exit; do not serve more requests on a corrupted process
//
// Errors in Node come in two flavors, sync (try/catch works) and
// async (only .catch / event handlers see them). A server needs
// both nets, plus a process-level last resort.

import http from 'node:http';
import { spawn } from 'node:child_process';

const call = (port, path) => new Promise((resolve, reject) => {
	const r = http.get({ host: '127.0.0.1', port, path }, (res) => {
		let b = '';
		res.on('data', (c) => { b += c; });
		res.on('end', () => resolve({ status: res.statusCode, body: b }));
	});
	r.on('error', reject);
});

// [1] sync throw, caught
{
	const app = http.createServer((req, res) => {
		try {
			throw new Error('boom-sync');
		} catch (err) {
			console.log(`[1] sync throw caught: "${err.message}" → 500 sent, process alive`);
			res.writeHead(500, { 'content-type': 'text/plain' });
			res.end('internal error');
		}
	});
	await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
	const r = await call(app.address().port, '/');
	console.log(`  client got ${r.status} — handled, socket closed cleanly`);
	await new Promise((resolve) => app.close(resolve));
}

// [2] async throw: .catch sees it, missing .catch kills the process
{
	const app = http.createServer((req, res) => {
		Promise.reject(new Error('boom-async'))
			.catch((err) => {
				console.log(`[2] async throw caught by .catch: "${err.message}" → 500 sent`);
				res.writeHead(500, { 'content-type': 'text/plain' });
				res.end('internal error');
			});
	});
	await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
	const caught = await call(app.address().port, '/');
	console.log(`  client got ${caught.status} — .catch is the async net`);
	await new Promise((resolve) => app.close(resolve));

	// the same rejection with NO .catch, in a child: process dies
	const child = spawn(process.execPath, ['-e', `
		const http = require('node:http');
		const app = http.createServer((req, res) => {
			Promise.reject(new Error('boom-async')); // nobody catches this
		});
		app.listen(0, '127.0.0.1', () => {
			const port = app.address().port;
			http.get({ host: '127.0.0.1', port }, (res) => res.resume());
		});
	`]);
	let childOut = '';
	child.stdout.on('data', (c) => { childOut += c; });
	child.stderr.on('data', (c) => { childOut += c; });
	const childExit = await new Promise((resolve) => child.on('exit', (code) => resolve(code)));
	const firstLine = childOut.split('\n').find((l) => l.trim().startsWith('Error'));
	console.log(`  same rejection with NO .catch: child died (exit ${childExit}) — "${(firstLine ?? '').trim()}"`);
	console.log('  since Node 15 an unhandled rejection CRASHES the process by default — .catch is not optional');
}

// [4] uncaughtException in a child process: last resort, log then exit
{
	const child = spawn(process.execPath, ['-e', `
		process.on('uncaughtException', (err) => {
			console.log('child: uncaughtException logged: ' + err.message);
			console.log('child: exiting deliberately — do not serve on a corrupted process');
			process.exit(1);
		});
		setTimeout(() => { throw new Error('boom-uncaught'); }, 50);
	`]);
	let out = '';
	child.stdout.on('data', (c) => { out += c; });
	await new Promise((resolve) => child.on('exit', resolve));
	console.log('[3] uncaughtException (child process):');
	console.log('  ' + out.trim().split('\n').join('\n  '));
}

console.log('--- key idea ---');
console.log('Sync errors: try/catch. Async errors: .catch. Unknown route: 404. Broken code: 500.');
console.log('uncaughtException: log, flush, exit — never keep serving.');
