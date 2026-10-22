export type DomainId = 1 | 2 | 3 | 4 | 5;

export interface DomainMeta {
	id: DomainId;
	slug: string;
	labelBn: string;
	labelEn: string;
	accent: string;
}

export const DOMAINS: DomainMeta[] = [
	{
		id: 1,
		slug: '1-node-anatomy-event-loop',
		labelBn: 'Node.js অ্যানাটমি ও event loop',
		labelEn: 'Node anatomy & the event loop',
		accent: '#3b82f6',
	},
	{
		id: 2,
		slug: '2-v8-memory-modules',
		labelBn: 'V8, মেমরি ও মডিউল ইন্টার্নাল',
		labelEn: 'V8, memory & module internals',
		accent: '#14b8a6',
	},
	{
		id: 3,
		slug: '3-multithreading-processes',
		labelBn: 'মাল্টিথ্রেডিং ও প্রসেস',
		labelEn: 'Multi-threading & processes',
		accent: '#f59e0b',
	},
	{
		id: 4,
		slug: '4-http-server-scratch',
		labelBn: 'শূন্য থেকে HTTP সার্ভার',
		labelEn: 'HTTP server from scratch',
		accent: '#8b5cf6',
	},
	{
		id: 5,
		slug: '5-production-server',
		labelBn: 'প্রোডাকশন সার্ভার',
		labelEn: 'Production server',
		accent: '#f43f5e',
	},
];
