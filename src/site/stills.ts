/**
 * The portal's stills, in public/stills/ and made by `npm run thumbnails`: its hero, the diorama
 * in each theme, in a wide shape for the screen's whole width and a narrower one for phones; and
 * each lesson's preview, in each theme. Only one of each set loads: the reader's theme and screen
 * pick it.
 */
import type { Lesson } from '../../content/portal.ts';
import type { ThemeName } from '../design/tokens.ts';

export const THEME_NAMES: readonly ThemeName[] = ['light', 'dark'];

export type HeroShape = 'wide' | 'narrow';

export const HERO_SHAPES: readonly HeroShape[] = ['wide', 'narrow'];

/**
 * The hero's shapes, in pixels: a band the screen's whole width, sharp on wide screens, its middle
 * kept on narrower ones; and 4:3 on phones.
 */
export const HERO_SIZES: Readonly<Record<HeroShape, { width: number; height: number }>> = {
  wide: { width: 2400, height: 640 },
  narrow: { width: 800, height: 600 },
};

/** A lesson's preview, in pixels: 2:1, sharp at the portal's card size. */
export const PREVIEW_SIZE = { width: 800, height: 400 } as const;

/** The hero still's address under the site's base path. */
export const heroPath = (theme: ThemeName, shape: HeroShape): string =>
  `stills/hero-${theme}-${shape}.webp`;

/** A lesson preview's address under the site's base path. */
export const previewPath = (image: Lesson['image'], theme: ThemeName): string =>
  `stills/${image}-${theme}.webp`;
