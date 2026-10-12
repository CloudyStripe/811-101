/**
 * The site's brand: its name and one-line description, shown on the portal (the home page) and
 * in its page title. Neutral by default; change it here.
 */
export const BRAND = {
  name: '811 101',
  tagline: 'Short, visual lessons on buried utilities and how they’re found.',
} as const;

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * Fills %BRAND_NAME% and %BRAND_TAGLINE% in a page's HTML. vite.config.ts runs it on every page
 * Vite serves or builds.
 */
export function fillBrand(html: string): string {
  return html
    .replaceAll('%BRAND_NAME%', escapeHtml(BRAND.name))
    .replaceAll('%BRAND_TAGLINE%', escapeHtml(BRAND.tagline));
}
