// Lesson 3-5 — cluster module: N processes, one port, round-robin.
//
// Expected output (pids vary; the shape is the lesson):
//
//   [1] primary forks 4 workers; ALL listen on ONE port (primary owns
//       the socket and hands connections to workers)
//   [2] 12 requests: each reports which worker pid served it —
//       distribution near-even (round-robin) on Linux
//   [3] killing a worker: the primary (with help from cluster's exit
//       event) forks a replacement; requests keep getting served
//
// Contrast with worker_threads: separate PROCESSES have separate
// memory. cluster's job is the sharing of the listening socket —
// distribution policy on POSIX is round-robin, handled by the primary.

import cluster from 'node:cluster';
import { createServer, request as httpRequest } from 'node:http';
import { pid } from 'node:process';

const N = 4;

function get(port, path = '/') {
	return new Promise((resolve, reject) => {
		const req = httpRequest({ host: '127.0.0.1', port, path }, (res) => {
			res.setEncoding('utf8');
			let body = '';
			res.on('data', (c) => { body += c; });
			res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ raw: body }); } });
		});
		req.on('error', reject);
		req.setTimeout(2000, () => { req.destroy(new Error('timeout')); });
		req.end();
	});
}

if (cluster.isPrimary) {
	// [1] fork a pool of worker processes
	for (let i = 0; i < N; i++) cluster.fork();
	console.log(`[1] primary pid=${pid} forked ${N} workers — all will accept on ONE shared port`);

	// first listening event carries the port every worker shares
	let port = 0;
	const up = new Set();
	await new Promise((allUp) => {
		cluster.on('listening', (worker, address) => {
			port = address.port;
			up.add(worker.id);
			if (up.size === N) allUp();
		});
	});
	console.log(`  all ${N} workers up on port ${port} — one port, one socket, four processes`);

	// [2] 12 requests, count which worker pid served each
	const counts = new Map();
	const replies = await Promise.all(Array.from({ length: 12 }, () => get(port)));
	for (const r of replies) counts.set(r.workerPid, (counts.get(r.workerPid) ?? 0) + 1);
	const spread = [...counts.values()].join('/');
	console.log(`[2] 12 requests → served by ${counts.size} workers, spread ${spread} — near-even handoff`);
	console.log('  primary owns the socket, hands one connection at a time to the next worker (round-robin)');

	// [3] kill a worker, wait for replacement, keep serving
	const victim = Object.values(cluster.workers)[0];
	const deadPid = victim.process.pid;
	victim.process.kill('SIGKILL');
	await new Promise((replaced) => {
		const onExit = () => {
			const w = cluster.fork(); // replacement
			w.once('listening', () => replaced()); // worker notifies via the same socket
		};
		victim.once('exit', onExit);
	});
	const after = await Promise.all(Array.from({ length: 6 }, () => get(port)));
	const newPids = new Set(after.map((r) => r.workerPid));
	console.log(`[3] killed pid ${deadPid}; replacement forked; 6 more requests served by pids ${[...newPids].join(', ')}`);
	console.log('--- key idea ---');
	console.log('cluster = process pool around ONE shared socket. Round-robin handoff, replacement on death.');
	process.exit(0); // workers hold the loop open; step down explicitly
} else {
	// worker: HTTP server on the inherited socket
	let served = 0;
	createServer((req, res) => {
		served++;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify({ workerPid: pid, served }));
	}).listen(0, () => {
		// cluster listens on the port set by the primary's shared handle
		process.send?.({ served });
	});
}
