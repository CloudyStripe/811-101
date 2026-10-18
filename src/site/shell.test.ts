/** The site shell, as each page gets it: its head, header, footer and loader. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_PATH, BRAND, SITE_URL, escapeHtml } from '../../config/brand.ts';
import { SECTIONS } from '../../content/portal.ts';
import { PAGES, lessonPage, lessonTransition, pageById, posterPath } from './pages.ts';
import { BOOT, CARDS_NAME, CARDS_SLOT, HERO_SLOT, LOADER_SLOT, renderPage } from './shell.ts';
import { HERO_SHAPES, THEME_NAMES, heroPath, previewPath } from './stills.ts';

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
    expect(html).not.toContain(HERO_SLOT);
    expect(html).not.toContain(CARDS_SLOT);
    expect(html).not.toMatch(/%BRAND_|%BASE%/);
  });

  it('the portal: its hero, the name and its line, with its stills for each theme and shape', () => {
    const html = render(pageById('portal'));
    expect(count(html, /<section class="hero"/g)).toBe(1);
    expect(html).toContain(`<h1 id="hero-title" class="hero-title">${escapeHtml(BRAND.name)}</h1>`);
    expect(html).toContain(`<p class="hero-line">${escapeHtml(BRAND.tagline)}</p>`);
    for (const theme of THEME_NAMES) {
      for (const shape of HERO_SHAPES) {
        expect(html).toContain(`--hero-${theme}-${shape}: url('/${heroPath(theme, shape)}')`);
      }
    }
  });

  it('the portal: a card for each lesson, with its preview in each theme, then what’s coming', () => {
    const page = render(pageById('portal'));
    // The cards' list alone, not the footer's lessons.
    const start = page.indexOf(`<ul class="cards" aria-label="${escapeHtml(CARDS_NAME)}">`);
    const html = page.slice(start, page.indexOf('</ul>', start));
    expect(start).toBeGreaterThan(0);
    // Each section's first card carries its id: the lessons' first, then what's coming.
    const ids = [...html.matchAll(/<li id="([^"]+)" class="card/g)].map(([, id]) => id);
    const live = SECTIONS.filter((s) => s.lessons.length > 0);
    const soon = SECTIONS.filter((s) => s.lessons.length === 0);
    expect(ids).toEqual([...live, ...soon].map((s) => s.id));
    for (const section of SECTIONS) {
      expect(html).toContain(escapeHtml(section.title));
      expect(html).toContain(escapeHtml(section.summary));
      for (const lesson of section.lessons) {
        // Named as its lesson's loader is, so one carries on into the other.
        expect(html).toContain(`data-transition="${lessonTransition(lessonPage(lesson).id)}"`);
        expect(html).toContain(`href="${BASE_PATH}${lesson.href}">${escapeHtml(lesson.title)}</a>`);
        expect(html).toContain(escapeHtml(lesson.summary));
        for (const theme of THEME_NAMES) {
          expect(html).toContain(
            `data-theme-image="${theme}" src="/${previewPath(lesson.image, theme)}"`,
          );
        }
      }
    }
    for (const section of soon) {
      expect(html).toContain(`<li id="${section.id}" class="card card-soon">`);
    }
    expect(count(html, /<p class="soon-label">Coming soon<\/p>/g)).toBe(soon.length);
    // Every preview waits until it's near the screen, so the other theme's never loads.
    const previews = [...html.matchAll(/<img class="card-image"[^>]*>/g)].map(([tag]) => tag);
    expect(previews.length).toBeGreaterThan(0);
    for (const tag of previews) expect(tag).toContain('loading="lazy"');
  });

  it.each(PAGES.filter((page) => page.scene))(
    '$id: its loader poster carries on from its preview on the portal',
    (page) => {
      expect(render(page)).toContain(`--lesson-transition: ${lessonTransition(page.id)}`);
    },
  );

  it('leaves no $ pattern behind from what it puts in', () => {
    const page = PAGES[0];
    if (!page) throw new Error('no pages');
    expect(renderPage('<head></head><body>$&$1</body>', page)).toContain('$&$1');
  });
});
