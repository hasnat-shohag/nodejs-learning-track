// @ts-check
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { DOMAINS } from './src/lib/domains.ts';
import { domainLessons, lessonPath } from './src/lib/lessons.ts';

const repoUrl = 'https://github.com/hasnat-shohag/nodejs-learning-track';
const docsRoot = join(dirname(fileURLToPath(import.meta.url)), 'src/content/docs');

/**
 * Only list lessons whose English MDX file exists, so the sidebar grows as
 * authoring progresses. A missing Bangla file falls back to English content
 * (Starlight's untranslated-page behaviour), so English presence governs.
 *
 * @param {string} slug
 */
const hasLesson = (slug) => existsSync(join(docsRoot, `${slug}.mdx`));

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
				baseUrl: `${repoUrl}/edit/main/`,
			},
			lastUpdated: true,
			pagination: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
			social: [{ icon: 'github', label: 'GitHub', href: repoUrl }],
			sidebar: [
				{
					...label('Start here', 'শুরু করুন'),
					items: [
						{ ...label('Syllabus & lessons', 'সিলেবাস ও লেসন'), link: 'learn/' },
						{ ...label('Progress dashboard', 'অগ্রগতি ড্যাশবোর্ড'), link: 'progress/' },
						{ ...label('Glossary', 'গ্লসারি'), link: 'glossary/' },
						{ ...label('Sources & license', 'উৎস ও লাইসেন্স'), link: 'about/' },
					],
				},
				...DOMAINS.map((domain) => ({
					...label(`0${domain.id} — ${domain.labelEn}`, `0${domain.id} — ${domain.labelBn}`),
					items: [
						{ ...label('Domain overview', 'ডোমেইন ওভারভিউ'), link: `learn/${domain.slug}/` },
						...domainLessons(domain.id)
							.map((lesson) => ({
								label: lesson.titleEn,
								translations: { 'bn-BD': lesson.titleBn },
								slug: lessonPath(lesson),
								attrs: { 'data-lesson-id': lesson.id },
							}))
							.filter((item) => hasLesson(item.slug)),
					],
				})),
			],
		}),
	],
});
