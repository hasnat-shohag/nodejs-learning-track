/** Prefix an internal path with the configured Astro base path.
 *
 * Pass the current page's locale so the link stays in the reader's language:
 * Starlight serves the Bangla site under `bn/`, and a bare `learn/...` link on a
 * bn page resolves fine but flips the reader to the English page.
 * `locale` is `Astro.locals.starlightRoute?.locale` — undefined for the root
 * (English) locale, 'bn' for Bangla.
 */
const base = import.meta.env.BASE_URL.endsWith('/')
	? import.meta.env.BASE_URL
	: `${import.meta.env.BASE_URL}/`;

export function siteUrl(path: string, locale?: string): string {
	const prefix = locale ? `${locale}/` : '';
	return `${base}${prefix}${path.replace(/^\/+/, '')}`;
}
