// Lesson 4-1 — node:http server lifecycle: listen, connection, request, socket reuse.
//
// Expected output:
//
//   [1] createServer returns immediately; nothing listens until .listen()
//   [2] listening event: kernel-assigned port visible via server.address()
//   [3] each request is method+url+headers, ALREADY parsed for you
//   [4] keep-alive: 3 requests ride ONE TCP connection (connection
//       event fires once) — one handshake amortized
//
// The server object is an EventEmitter; 'connection' hands you a raw
// net.Socket, and 'request' rides on top of it as parsed HTTP. HTTP/1.1
// keep-alive is why servers feel fast: connection setup is the expensive
// part, request setup is not.

import http from 'node:http';

// [1] server exists, bound to nothing
const server = http.createServer((req, res) => {
	res.end('ok');
});
console.log('[1] createServer() returned — listening?', server.listening);

// [2] listen: bind + kernel port assignment
let connections = 0;
server.on('connection', () => connections++);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
console.log(`[2] 'listening' fired — server.address().port = ${port} (kernel assigned)`);

// [3] what the handler actually receives: parsed, not raw
const seen = [];
const echo = http.createServer((req, res) => {
	seen.push({ method: req.method, url: req.url, httpVersion: req.httpVersion });
	res.end('ok');
});
await new Promise((resolve) => echo.listen(0, '127.0.0.1', resolve));
const echoPort = echo.address().port;
await new Promise((resolve, reject) => {
	const req = http.request(
		{ host: '127.0.0.1', port: echoPort, path: '/hello?x=1', method: 'POST', headers: { 'x-lesson': '4-1' } },
		(res) => { res.resume(); res.on('end', resolve); },
	);
	req.on('error', reject);
	req.end();
});
console.log(`[3] handler got (already parsed): ${JSON.stringify(seen[0])}`);

// [4] keep-alive: 3 requests, 1 connection
const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
let served = 0;
for (let i = 0; i < 3; i++) {
	await new Promise((resolve, reject) => {
		http.get({ host: '127.0.0.1', port, agent }, (res) => { res.resume(); res.on('end', () => { served++; resolve(); }); }).on('error', reject);
	});
}
console.log(`[4] ${served} requests over ${connections} TCP connection(s) — keep-alive reused the socket`);
console.log('--- key idea ---');
console.log('Server = EventEmitter over sockets. listen binds once; keep-alive amortizes; handler gets parsed HTTP.');
agent.destroy();
echo.close();
await new Promise((resolve) => server.close(resolve));
