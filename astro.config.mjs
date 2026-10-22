// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

/**
 * Sidebar labels localize via `translations`, keyed by the locale's `lang`
 * tag (`en`, `bn-BD`) — Starlight's `pickLang` falls back to `label` when
 * the key is missing.
 *
 * @param {string} en
 * @param {string} bn
 */
const label = (en, bn) => ({ label: en, translations: { 'bn-BD': bn } });

export default defineConfig({
	site: 'https://hasnat-shohag.github.io',
	base: '/nodejs-tutorial',
	trailingSlash: 'always',
	integrations: [
		starlight({
			title: {
				en: 'Node.js Learning Track',
				'bn-BD': 'Node.js লার্নিং ট্র্যাক',
			},
			description:
				'Node.js internals and server-side fundamentals from the official docs — the event loop, libuv, worker_threads, and an HTTP server built from scratch. Bilingual English/Bangla lessons with runnable demos.',
			locales: {
				root: { label: 'English', lang: 'en' },
				bn: { label: 'বাংলা', lang: 'bn-BD' },
			},
			defaultLocale: 'root',
			favicon: '/favicon.svg',
			customCss: ['./src/styles/custom.css'],
			components: {
				Head: './src/components/starlight/Head.astro',
			},
			editLink: {
				baseUrl: 'https://github.com/hasnat-shohag/nodejs-learning-track/edit/main/',
			},
			lastUpdated: true,
			pagination: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
			sidebar: [
				{
					...label('Learn', 'শেখা'),
					items: [{ ...label('Index', 'ইনডেক্স'), link: 'learn/' }],
				},
			],
		}),
	],
});
