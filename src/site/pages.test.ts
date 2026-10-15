/** The page registry: every page it lists exists, links up, and has what its shell needs. */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../../content/portal.ts';
import { PAGES, pageForHtml, posterPath, sectionOf } from './pages.ts';

describe('the pages', () => {
  it('have unique ids, files and addresses', () => {
    for (const key of ['id', 'html', 'path'] as const) {
      const values = PAGES.map((p) => p[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it.each(PAGES)('$id: its HTML file is there, and its address ends where a page does', (page) => {
    expect(existsSync(page.html)).toBe(true);
    expect(page.path === '' || page.path.endsWith('/') || page.path.endsWith('.html')).toBe(true);
    expect(page.description.length).toBeGreaterThan(20);
  });

  it.each(PAGES)('$id: has budgets, a share image, and (with a 3D view) posters', (page) => {
    expect(page.budgets).toBeDefined();
    expect(existsSync(`public/share/${page.share.image}`), page.share.image).toBe(true);
    if (page.scene) {
      for (const theme of ['light', 'dark'] as const) {
        expect(existsSync(`public/${posterPath(page, theme)}`), theme).toBe(true);
      }
    }
  });

  it('lists every lesson on the portal, under its section', () => {
    for (const section of SECTIONS) {
      for (const lesson of section.lessons) {
        const page = PAGES.find((p) => p.path === lesson.href);
        expect(page, lesson.href).toBeDefined();
        expect(sectionOf(lesson.href)).toEqual({ id: section.id, title: section.title });
      }
    }
  });
});

describe('pageForHtml', () => {
  it('finds each page from its path in the project, either slash', () => {
    for (const page of PAGES) {
      expect(pageForHtml(page.html)?.id).toBe(page.id);
      expect(pageForHtml(page.html.replaceAll('/', '\\'))?.id).toBe(page.id);
      expect(pageForHtml(`./${page.html}`)?.id).toBe(page.id);
    }
  });

  it('gives a page that isn’t registered nothing, not another page’s head', () => {
    expect(pageForHtml('somewhere/else.html')).toBeUndefined();
    expect(pageForHtml('training/other-lab/index.html')).toBeUndefined();
  });
});
