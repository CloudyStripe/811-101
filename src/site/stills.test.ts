import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../../content/portal.ts';
import { HERO_SHAPES, THEME_NAMES, heroPath, previewPath } from './stills.ts';

describe('the portal’s stills', () => {
  it('has its hero for each theme and shape', () => {
    for (const theme of THEME_NAMES) {
      for (const shape of HERO_SHAPES)
        expect(existsSync(`public/${heroPath(theme, shape)}`)).toBe(true);
    }
  });

  it.each(SECTIONS.flatMap((section) => section.lessons))(
    '$title: has its preview for each theme',
    (lesson) => {
      for (const theme of THEME_NAMES) {
        expect(existsSync(`public/${previewPath(lesson.image, theme)}`)).toBe(true);
      }
    },
  );
});
