import { DOMAINS, type DomainId } from './domains';

export interface LessonMeta {
	id: string;
	domain: DomainId;
	slug: string;
	titleEn: string;
	titleBn: string;
}

export const LESSONS: LessonMeta[] = [
	{ id: '1-1', domain: 1, slug: '1-1-process-anatomy', titleEn: 'Node process anatomy: V8, libuv, bindings, process', titleBn: 'Node প্রসেসের অ্যানাটমি: V8, libuv, bindings, process' },
	{ id: '1-2', domain: 1, slug: '1-2-event-loop-phases', titleEn: 'Event loop phases: timers, poll, check, close', titleBn: 'Event loop-এর ফেজ: timers, poll, check, close' },
	{ id: '1-3', domain: 1, slug: '1-3-microtask-ordering', titleEn: 'Microtask ordering: nextTick vs Promise vs setImmediate', titleBn: 'মাইক্রোটাস্ক অর্ডারিং: nextTick বনাম Promise বনাম setImmediate' },
	{ id: '1-4', domain: 1, slug: '1-4-blocking-the-loop', titleEn: 'Blocking the loop: the cost model, measuring event-loop lag', titleBn: 'লুপ ব্লক করা: কস্ট মডেল ও event-loop lag মাপা' },
	{ id: '1-5', domain: 1, slug: '1-5-libuv-thread-pool', titleEn: 'libuv thread pool: UV_THREADPOOL_SIZE and off-thread work', titleBn: 'libuv thread pool: UV_THREADPOOL_SIZE ও অফ-থ্রেড কাজ' },
	{ id: '1-6', domain: 1, slug: '1-6-timers-deep', titleEn: 'Timers deep: ref/unref, nesting, setInterval drift', titleBn: 'টাইমার ডিপ: ref/unref, নেস্টিং, setInterval drift' },

	{ id: '2-1', domain: 2, slug: '2-1-v8-server-view', titleEn: 'V8 from a server dev’s view: JIT, hidden classes, GC', titleBn: 'সার্ভার ডেভের চোখে V8: JIT, হিডেন ক্লাস, GC' },
	{ id: '2-2', domain: 2, slug: '2-2-heap-stack-limits', titleEn: 'Heap vs stack, --max-old-space-size, OOM diagnosis', titleBn: 'Heap বনাম stack, --max-old-space-size, OOM ডায়াগনোসিস' },
	{ id: '2-3', domain: 2, slug: '2-3-memory-leaks', titleEn: 'Memory leaks: closures, timers, listeners; heap snapshots', titleBn: 'মেমরি লিক: ক্লোজার, টাইমার, লিসেনার; heap snapshot' },
	{ id: '2-4', domain: 2, slug: '2-4-module-internals', titleEn: 'CJS vs ESM internals: resolution, module cache, ESM loader', titleBn: 'CJS বনাম ESM ইন্টার্নাল: রিজলিউশন, মডিউল ক্যাশ, ESM লোডার' },
	{ id: '2-5', domain: 2, slug: '2-5-native-boundary', titleEn: 'The native boundary: N-API addons, JS calling C++', titleBn: 'নেটিভ বাউন্ডারি: N-API অ্যাডন, JS থেকে C++ কল' },

	{ id: '3-1', domain: 3, slug: '3-1-worker-threads', titleEn: 'worker_threads: Worker, MessageChannel, transfer vs clone', titleBn: 'worker_threads: Worker, MessageChannel, transfer বনাম clone' },
	{ id: '3-2', domain: 3, slug: '3-2-sharedarraybuffer', titleEn: 'SharedArrayBuffer + Atomics: shared memory across threads', titleBn: 'SharedArrayBuffer ও Atomics: থ্রেডের মধ্যে শেয়ার্ড মেমরি' },
	{ id: '3-3', domain: 3, slug: '3-3-cpu-vs-io', titleEn: 'CPU-bound vs I/O-bound: benchmark sync vs worker', titleBn: 'CPU-বাউন্ড বনাম I/O-বাউন্ড: sync বনাম worker বেঞ্চমার্ক' },
	{ id: '3-4', domain: 3, slug: '3-4-worker-pool', titleEn: 'Worker pool pattern: queue and pool sizing', titleBn: 'ওয়ার্কার পুল প্যাটার্ন: কিউ ও পুল সাইজিং' },
	{ id: '3-5', domain: 3, slug: '3-5-cluster', titleEn: 'cluster module: processes, round-robin, shared port', titleBn: 'cluster মডিউল: প্রসেস, রাউন্ড-রবিন, শেয়ার্ড পোর্ট' },
	{ id: '3-6', domain: 3, slug: '3-6-child-process', titleEn: 'child_process + signals: spawn/fork/exec, IPC, shutdown', titleBn: 'child_process ও সিগন্যাল: spawn/fork/exec, IPC, শাটডাউন' },

	{ id: '4-1', domain: 4, slug: '4-1-http-lifecycle', titleEn: 'node:http lifecycle: createServer, req/res, socket events', titleBn: 'node:http লাইফসাইকেল: createServer, req/res, socket ইভেন্ট' },
	{ id: '4-2', domain: 4, slug: '4-2-request-parsing', titleEn: 'Request parsing: URL, query, headers, body buffering vs streaming', titleBn: 'রিকোয়েস্ট পার্সিং: URL, query, হেডার, বডি বাফারিং বনাম স্ট্রিমিং' },
	{ id: '4-3', domain: 4, slug: '4-3-router-middleware', titleEn: 'Build a router + middleware chain (no Express)', titleBn: 'নিজের রাউটার ও মিডলওয়্যার চেইন (Express ছাড়া)' },
	{ id: '4-4', domain: 4, slug: '4-4-error-handling', titleEn: 'Error handling: ‘error’ events, async wrappers, 500s', titleBn: 'এরর হ্যান্ডলিং: ‘error’ ইভেন্ট, async র‍্যাপার, 500' },
	{ id: '4-5', domain: 4, slug: '4-5-streams', titleEn: 'Streams: Readable/Writable/Duplex/Transform, object mode', titleBn: 'স্ট্রিম: Readable/Writable/Duplex/Transform, অবজেক্ট মোড' },
	{ id: '4-6', domain: 4, slug: '4-6-backpressure', titleEn: 'Backpressure: pipe, highWaterMark, .write() === false', titleBn: 'ব্যাকপ্রেশার: pipe, highWaterMark, .write() === false' },

	{ id: '5-1', domain: 5, slug: '5-1-buffers', titleEn: 'Buffers & binary data: pool, TypedArray views, encoding', titleBn: 'Buffer ও বাইনারি ডেটা: পুল, TypedArray ভিউ, এনকোডিং' },
	{ id: '5-2', domain: 5, slug: '5-2-file-uploads', titleEn: 'File uploads: multipart parse, streaming to disk', titleBn: 'ফাইল আপলোড: multipart পার্স, ডিস্কে স্ট্রিমিং' },
	{ id: '5-3', domain: 5, slug: '5-3-static-server', titleEn: 'Static file server: ETag, Cache-Control, MIME, ranges', titleBn: 'স্ট্যাটিক ফাইল সার্ভার: ETag, Cache-Control, MIME, রেঞ্জ' },
	{ id: '5-4', domain: 5, slug: '5-4-tls-server', titleEn: 'TLS server: node:https, self-signed cert demo', titleBn: 'TLS সার্ভার: node:https, সেলফ-সাইনড সার্টিফিকেট ডেমো' },
	{ id: '5-5', domain: 5, slug: '5-5-server-security', titleEn: 'Security: timing-safe compare, header hygiene, limits', titleBn: 'সিকিউরিটি: timing-safe তুলনা, হেডার হাইজিন, লিমিট' },
	{ id: '5-6', domain: 5, slug: '5-6-diagnostics', titleEn: 'Diagnostics: --inspect, perf_hooks, flamegraphs', titleBn: 'ডায়াগনস্টিকস: --inspect, perf_hooks, ফ্লেমগ্রাফ' },
	{ id: '5-7', domain: 5, slug: '5-7-capstone', titleEn: 'Capstone: static server + worker pool for image resize', titleBn: 'ক্যাপস্টোন: স্ট্যাটিক সার্ভার + ইমেজ রিসাইজের ওয়ার্কার পুল' },
];

export const TOTAL_LESSONS = LESSONS.length;

export function domainLessons(domain: DomainId): LessonMeta[] {
	return LESSONS.filter((lesson) => lesson.domain === domain);
}

export function lessonPath(lesson: LessonMeta): string {
	const domain = DOMAINS.find((item) => item.id === lesson.domain);
	return `learn/${domain?.slug}/${lesson.slug}`;
}
