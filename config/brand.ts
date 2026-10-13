/**
 * The site's brand: its name and one-line description, shown in the header, on the portal (the
 * home page) and in share previews, and where the site is published. Neutral by default; change
 * it here.
 */
export const BRAND = {
  name: '811 101',
  tagline: 'Short, visual lessons on buried utilities and how they’re found.',
} as const;

/**
 * Where the site is published, with a trailing slash. Its path is the build's base path, and share
 * previews link here, since they need whole addresses.
 */
export const SITE_URL = 'https://cloudystripe.github.io/811-101/';

/** The site's path on its host: every page and file sits under it. */
export const BASE_PATH = new URL(SITE_URL).pathname;

export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * Fills %BRAND_NAME% and %BRAND_TAGLINE% in a page's HTML. The site shell (src/site/vite.ts) runs
 * it on every page Vite serves or builds.
 */
export function fillBrand(html: string): string {
  return html
    .replaceAll('%BRAND_NAME%', escapeHtml(BRAND.name))
    .replaceAll('%BRAND_TAGLINE%', escapeHtml(BRAND.tagline));
}
