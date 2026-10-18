/**
 * The portal's stills, in public/stills/ and made by `npm run thumbnails`: its hero, the whole
 * diorama in its sky, in each theme, in a wide shape and a narrow one for phones; and each
 * lesson's preview, in each theme. Only one of each set loads: the reader's theme and screen pick
 * it.
 */
import type { Lesson } from '../../content/portal.ts';
import type { ThemeName } from '../design/tokens.ts';

export const THEME_NAMES: readonly ThemeName[] = ['light', 'dark'];

export type HeroShape = 'wide' | 'narrow';

export const HERO_SHAPES: readonly HeroShape[] = ['wide', 'narrow'];

/**
 * The hero's shapes, in pixels. Wide: the model from the south with a margin of sky either side,
 * and the sky's whole height, top to bottom, so the page's own sky carries on from its edges.
 * Narrow: the model as a phone shows it, from the east, with sky above it for the site's name.
 */
export const HERO_SIZES: Readonly<Record<HeroShape, { width: number; height: number }>> = {
  wide: { width: 1642, height: 1350 },
  narrow: { width: 780, height: 1240 },
};

/** A lesson's preview, in pixels: 2:1, sharp at the portal's card size. */
export const PREVIEW_SIZE = { width: 800, height: 400 } as const;

/** The hero still's address under the site's base path. */
export const heroPath = (theme: ThemeName, shape: HeroShape): string =>
  `stills/hero-${theme}-${shape}.webp`;

/** A lesson preview's address under the site's base path. */
export const previewPath = (image: Lesson['image'], theme: ThemeName): string =>
  `stills/${image}-${theme}.webp`;
