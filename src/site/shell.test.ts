/** The site shell, as each page gets it: its head, header, footer and loader. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_PATH, SITE_URL } from '../../config/brand.ts';
import { PAGES, posterPath } from './pages.ts';
import { BOOT, LOADER_SLOT, renderPage } from './shell.ts';

const render = (page: (typeof PAGES)[number]) => renderPage(readFileSync(page.html, 'utf8'), page);
const count = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].length;

describe('renderPage', () => {
  it.each(PAGES)('$id: charset in the first 1024 bytes, then the settings script', (page) => {
    const html = render(page);
    const charset = html.indexOf('<meta charset="utf-8" />');
    expect(charset).toBeGreaterThan(0);
    expect(charset + '<meta charset="utf-8" />'.length).toBeLessThan(1024);
    // Straight after it, and so before any style or module script.
    expect(html.indexOf(`<script>${BOOT}</script>`)).toBe(
      charset + '<meta charset="utf-8" />\n    '.length,
    );
  });

  it.each(PAGES)('$id: one title, a description, and a share preview by whole address', (page) => {
    const html = render(page);
    expect(count(html, /<title>/g)).toBe(1);
    expect(html).toContain(`<title>${page.title.replaceAll('&', '&amp;')}</title>`);
    expect(html).toContain('<meta name="description"');
    expect(html).toContain(
      `<meta property="og:image" content="${SITE_URL}share/${page.share.image}" />`,
    );
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    if (page.noindex) {
      expect(html).toContain('<meta name="robots" content="noindex" />');
      expect(html).not.toContain('rel="canonical"');
    } else {
      expect(html).toContain(`<link rel="canonical" href="${SITE_URL}${page.path}" />`);
    }
  });

  it.each(PAGES)('$id: favicons and theme colors for both themes', (page) => {
    const html = render(page);
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(count(html, /<meta name="theme-color"/g)).toBe(2);
  });

  it.each(PAGES)('$id: the header, with one h1 on the page', (page) => {
    const html = render(page);
    expect(count(html, /<header class="site-header"/g)).toBe(1);
    expect(html).toContain(`<a class="site-home" href="${BASE_PATH}"`);
    expect(html).toContain('id="site-settings"');
    // Lessons are named in the header; other pages have their own h1.
    expect(count(html, /<h1[\s>]/g)).toBe(1);
    if (page.heading) expect(html).toContain(`<h1 class="site-title">`);
  });

  it.each(PAGES)('$id: the footer and loader where they belong, and no placeholders', (page) => {
    const html = render(page);
    expect(html.includes('<footer class="site-footer">')).toBe(page.footer);
    expect(html.includes('class="scene-loader"')).toBe(page.scene);
    if (page.scene) {
      // From public/, root-relative: the build puts the base path in front.
      expect(html).toContain(`url('/${posterPath(page, 'light')}')`);
      expect(html).toContain(`url('/${posterPath(page, 'dark')}')`);
      // Without script, no view loads, so no loader shows.
      expect(html).toContain(
        '<noscript><style>.scene-loader { display: none; }</style></noscript>',
      );
    }
    expect(html).not.toContain(LOADER_SLOT);
    expect(html).not.toMatch(/%BRAND_|%BASE%/);
  });

  it('leaves no $ pattern behind from what it puts in', () => {
    const page = PAGES[0];
    if (!page) throw new Error('no pages');
    expect(renderPage('<head></head><body>$&$1</body>', page)).toContain('$&$1');
  });
});
