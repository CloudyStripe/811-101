/**
 * The portal's stills, in public/stills/ and made by `npm run thumbnails`: its hero, in each theme
 * and in a wide shape for wide screens and a square one for phones; and each lesson's preview, in
 * each theme. Only one of each set loads: the reader's theme and screen pick it.
 */
import type { Lesson } from '../../content/portal.ts';
import type { ThemeName } from '../design/tokens.ts';

export const THEME_NAMES: readonly ThemeName[] = ['light', 'dark'];

export type HeroShape = 'wide' | 'square';

export const HERO_SHAPES: readonly HeroShape[] = ['wide', 'square'];

/** The hero's shapes, in pixels: the space it fills beside the words, or under them on phones. */
export const HERO_SIZES: Readonly<Record<HeroShape, { width: number; height: number }>> = {
  wide: { width: 1200, height: 900 },
  square: { width: 800, height: 800 },
};

/** A lesson's preview, in pixels: 16:9, sharp at the portal's tile size. */
export const PREVIEW_SIZE = { width: 800, height: 450 } as const;

/** The hero still's address under the site's base path. */
export const heroPath = (theme: ThemeName, shape: HeroShape): string =>
  `stills/hero-${theme}-${shape}.webp`;

/** A lesson preview's address under the site's base path. */
export const previewPath = (image: Lesson['image'], theme: ThemeName): string =>
  `stills/${image}-${theme}.webp`;
