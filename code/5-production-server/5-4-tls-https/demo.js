// Lesson 5-4 — TLS: self-signed cert, https server, client that trusts it.
//
// Expected output (paths/serials vary):
//
//   [1] openssl makes a self-signed cert: key + cert, 365 days
//   [2] node:https = node:http + TLS options; the server listens,
//       a client WITHOUT the CA rejects (self-signed = untrusted
//       by default — that is TLS working, not failing)
//   [3] client WITH the CA option connects: certificate verified,
//       encrypted HTTP flows both ways
//
// HTTPS is http over a TLS layer: the certificate proves identity,
// the handshake derives a shared secret, then every byte is encrypted.
// In production you get certs from a CA (Let's Encrypt); locally you
// self-sign, and the client must opt in to trust you.

import https from 'node:https';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keyFile = join(tmpdir(), `lesson-key-${process.pid}.pem`);
const certFile = join(tmpdir(), `lesson-cert-${process.pid}.pem`);
process.on('exit', () => { rmSync(keyFile, { force: true }); rmSync(certFile, { force: true }); });

// [1] make a self-signed cert with openssl
{
	console.log('[1] self-signed certificate:');
	const mk = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyFile, '-out', certFile, '-days', '365', '-nodes', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost']);
	if (mk.status !== 0) {
		console.log('  openssl unavailable:', mk.stderr?.toString().slice(0, 80));
		process.exit(1);
	}
	const read = spawnSync('openssl', ['x509', '-in', certFile, '-noout', '-subject', '-dates', '-ext', 'subjectAltName']);
	console.log('  ' + read.stdout.toString().trim().split('\n').join('\n  '));
}

// [2] https server on it
{
	console.log('[2] node:https server:');
	const { readFileSync } = await import('node:fs');
	const server = https.createServer({ key: readFileSync(keyFile), cert: readFileSync(certFile) }, (req, res) => {
		res.writeHead(200, { 'content-type': 'text/plain' });
		res.end('secure hello');
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const port = server.address().port;

	// client WITHOUT the CA: rejects the self-signed cert
	const untrusted = await new Promise((resolve) => {
		https.get({ host: '127.0.0.1', port, rejectUnauthorized: true }, resolve).on('error', (e) => resolve({ rejected: e.code ?? e.message }));
	});
	if (untrusted.rejected) {
		console.log(`  client without CA: REFUSED — ${untrusted.rejected}`);
		console.log('  the handshake checks identity BEFORE any HTTP: this is the system working');
	} else {
		console.log('  (unexpected: untrusted connect went through — check node defaults)');
	}

	// [3] client WITH the CA option: verified, encrypted
	{
		console.log('[3] client with the CA option:');
		const reply = await new Promise((resolve, reject) => {
			https.get({ host: '127.0.0.1', port, ca: readFileSync(certFile) }, resolve).on('error', reject);
		});
		const protocol = reply.socket.getProtocol(); // socket detaches after end — read it now
		let body = '';
		reply.on('data', (c) => { body += c; });
		await new Promise((r) => reply.on('end', r));
		console.log(`  status ${reply.statusCode}, protocol ${protocol}, body: "${body}"`);
		console.log('  certificate verified against the CA, HTTP over the encrypted channel');
	}
	// [2] contrast: same content over plain http
	const plain = http.createServer((req, res) => { res.end('insecure hello'); });
	await new Promise((r) => plain.listen(0, '127.0.0.1', r));
	const p = await new Promise((resolve, reject) => {
		http.get({ host: '127.0.0.1', port: plain.address().port }, resolve).on('error', reject);
	});
	let pb = '';
	p.on('data', (c) => { pb += c; });
	await new Promise((r) => p.on('end', r));
	console.log(`  same server over plain http: "${pb}" — no identity check, no encryption`);
	await new Promise((r) => plain.close(r));
	await new Promise((r) => server.close(r));
}

console.log('--- key idea ---');
console.log('https = http + cert + handshake. Locally: self-sign, client opts in. Prod: real CA.');
