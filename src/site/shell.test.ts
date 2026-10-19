/** The site shell, as each page gets it: its head, header, footer and loader. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_PATH, BRAND, SITE_URL, escapeHtml } from '../../config/brand.ts';
import { SECTIONS } from '../../content/portal.ts';
import {
  PAGES,
  POSTER_SHAPES,
  lessonPage,
  lessonTransition,
  pageById,
  posterPath,
  POSTER_TALL,
} from './pages.ts';
import { POSTER_PLACEHOLDERS, STILL_PLACEHOLDERS } from './placeholders.ts';
import {
  BOOT,
  CARDS_NAME,
  CARDS_SLOT,
  HERO_SLOT,
  LOADER_SLOT,
  picturesScript,
  renderPage,
} from './shell.ts';
import { HERO_STACKS, THEME_NAMES, heroPath, previewPath } from './stills.ts';

const render = (page: (typeof PAGES)[number]) => renderPage(readFileSync(page.html, 'utf8'), page);
const count = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].length;

/** A tiny copy, inline, as the shell writes it. */
const TINY = "url('data:image/webp;base64,";

/**
 * Runs a page's pictures script against a stand-in document: a saved theme (or none), the device's
 * theme, whether the screen is upright, and whether the portal's hero stacks. Returns what it
 * fetches for the page now (`hrefs`, at `priorities`), what it fetches once the page has loaded,
 * for later (`later`), and what it marks the page with as each lands.
 */
function runPictures(
  script: string,
  {
    saved,
    dark,
    stacks = false,
    tall = false,
  }: { saved?: 'light' | 'dark'; dark: boolean; stacks?: boolean; tall?: boolean },
) {
  interface Link {
    rel?: string;
    as?: string;
    href?: string;
    priority?: string;
    onload?: () => void;
  }
  const links: Link[] = [];
  const loaded: (() => void)[] = [];
  const root = { dataset: (saved ? { theme: saved } : {}) as Record<string, string> };
  const document = {
    documentElement: root,
    head: {
      appendChild: (link: Link) => {
        // A preload starts at once, so it must be set up before it's put in.
        if (link.rel === 'preload') expect(link.as, link.href).toBe('image');
        links.push(link);
      },
    },
    createElement: (): Link & { setAttribute: (name: string, value: string) => void } => ({
      setAttribute(this: Link, name: string, value: string) {
        if (name === 'fetchpriority') this.priority = value;
      },
    }),
  };
  const matchMedia = (query: string) => ({
    matches: query.includes('prefers-color-scheme') ? dark : query === POSTER_TALL ? tall : stacks,
  });
  const addEventListener = (type: string, listener: () => void) => {
    if (type === 'load') loaded.push(listener);
  };
  // The script as a page runs it, with the stand-ins for the page's globals.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- running the page's own script
  const run = new Function('document', 'matchMedia', 'addEventListener', script) as (
    doc: typeof document,
    media: typeof matchMedia,
    listen: typeof addEventListener,
  ) => void;
  run(document, matchMedia, addEventListener);
  const now = [...links];
  for (const link of now) link.onload?.();
  for (const listener of loaded) listener();
  const later = links.filter((link) => !now.includes(link));
  expect(now.every((link) => link.rel === 'preload')).toBe(true);
  expect(later.every((link) => link.rel === 'prefetch')).toBe(true);
  return {
    hrefs: now.map((l) => l.href),
    priorities: now.map((l) => l.priority),
    later: later.map((l) => l.href),
    root,
  };
}

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
      for (const theme of THEME_NAMES) {
        for (const shape of POSTER_SHAPES) {
          expect(html).toContain(`url('/${posterPath(page, theme, shape)}')`);
        }
      }
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
      expect(html).toContain(`--hero-${theme}: url('/${heroPath(theme)}')`);
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

  it.each(PAGES.filter((page) => page.scene))(
    '$id: its loader stands its poster over a tiny copy of it, inline, in each theme and shape',
    (page) => {
      const html = render(page);
      for (const theme of THEME_NAMES) {
        for (const shape of POSTER_SHAPES) {
          expect(html).toContain(`--poster-${theme}-${shape}-tiny: ${TINY}`);
          expect(POSTER_PLACEHOLDERS[posterPath(page, theme, shape)]).toBeDefined();
        }
      }
    },
  );

  it.each(PAGES.filter((page) => page.scene))(
    '$id: its head fetches the poster in the reader’s theme and the screen’s shape, and marks the page once it’s in',
    (page) => {
      const script = picturesScript(page);
      if (!script) throw new Error('no pictures script');
      expect(render(page)).toContain(`<script>${script}</script>`);
      const url = (theme: 'light' | 'dark', shape: 'wide' | 'tall') =>
        `${BASE_PATH}${posterPath(page, theme, shape)}`;
      expect(runPictures(script, { dark: false }).hrefs).toEqual([url('light', 'wide')]);
      expect(runPictures(script, { dark: true }).hrefs).toEqual([url('dark', 'wide')]);
      expect(runPictures(script, { dark: false, tall: true }).hrefs).toEqual([
        url('light', 'tall'),
      ]);
      // A theme chosen in the settings wins over the device's.
      expect(runPictures(script, { saved: 'light', dark: true, tall: true }).hrefs).toEqual([
        url('light', 'tall'),
      ]);
      // The stylesheet picks the same shape.
      expect(readFileSync('src/site/site.css', 'utf8')).toContain(`@media ${POSTER_TALL} {`);
      const run = runPictures(script, { dark: false });
      expect(run.priorities).toEqual(['high']);
      expect(run.root.dataset.poster).toBe('ready');
    },
  );

  it('the portal: its head fetches the hero, where it shows, and the previews, in the reader’s theme', () => {
    const script = picturesScript(pageById('portal'));
    if (!script) throw new Error('no pictures script');
    const lessons = SECTIONS.flatMap((section) => section.lessons);
    const previews = (theme: 'light' | 'dark') =>
      lessons.map((lesson) => `${BASE_PATH}${previewPath(lesson.image, theme)}`);
    expect(runPictures(script, { dark: false, stacks: false }).hrefs).toEqual([
      `${BASE_PATH}${heroPath('light')}`,
      ...previews('light'),
    ]);
    expect(runPictures(script, { saved: 'dark', dark: false, stacks: false }).hrefs).toEqual([
      `${BASE_PATH}${heroPath('dark')}`,
      ...previews('dark'),
    ]);
    // Where the hero stacks, it shows no model, so its still isn't fetched.
    expect(runPictures(script, { dark: false, stacks: true }).hrefs).toEqual(previews('light'));
    // Once it's in, each lesson's poster, in the theme and the screen's shape, for later.
    const posters = (theme: 'light' | 'dark', shape: 'wide' | 'tall') =>
      lessons.map((lesson) => `${BASE_PATH}${posterPath(lessonPage(lesson), theme, shape)}`);
    expect(runPictures(script, { dark: false }).later).toEqual(posters('light', 'wide'));
    expect(runPictures(script, { dark: true, tall: true }).later).toEqual(posters('dark', 'tall'));
    expect(readFileSync('src/pages/portal/portal.css', 'utf8')).toContain(
      `@media ${HERO_STACKS} {`,
    );
  });

  it('the portal: its hero and its previews stand over tiny copies of themselves, inline', () => {
    const html = render(pageById('portal'));
    for (const theme of THEME_NAMES) {
      expect(html).toContain(`--hero-${theme}-tiny: ${TINY}`);
      expect(STILL_PLACEHOLDERS[heroPath(theme)]).toBeDefined();
    }
    const previews = [...html.matchAll(/<img class="card-image"[^>]*>/g)].map(([tag]) => tag);
    expect(previews.length).toBeGreaterThan(0);
    for (const tag of previews) expect(tag).toContain(`style="--tiny: ${TINY}`);
  });

  it('every placeholder is a tiny WebP, inline', () => {
    const all = { ...STILL_PLACEHOLDERS, ...POSTER_PLACEHOLDERS };
    expect(Object.keys(all).length).toBeGreaterThan(0);
    for (const [path, uri] of Object.entries(all)) {
      expect(uri, path).toMatch(/^data:image\/webp;base64,UklGR[A-Za-z0-9+/=]+$/);
      expect(uri.length, path).toBeLessThan(1200);
    }
  });

  it.each(PAGES.filter((page) => !page.scene && page.id !== 'portal'))(
    '$id: no pictures to fetch first, so no script for them',
    (page) => {
      expect(picturesScript(page)).toBeNull();
    },
  );

  it('leaves no $ pattern behind from what it puts in', () => {
    const page = PAGES[0];
    if (!page) throw new Error('no pages');
    expect(renderPage('<head></head><body>$&$1</body>', page)).toContain('$&$1');
  });
});
