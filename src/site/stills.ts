/**
 * The portal's stills, in public/stills/ and made by `npm run thumbnails`: its hero, the whole
 * diorama in its sky, in each theme, which loads only where it stands beside the site's name; and
 * each lesson's preview, in each theme. Only the reader's theme's loads.
 */
import type { Lesson } from '../../content/portal.ts';
import type { ThemeName } from '../design/tokens.ts';

export const THEME_NAMES: readonly ThemeName[] = ['light', 'dark'];

/**
 * The hero, in pixels: the model from the south with a margin of sky either side, and the sky's
 * whole height, top to bottom, so the page's own sky carries on from its edges.
 */
export const HERO_SIZE = { width: 1642, height: 1350 } as const;

/** A lesson's preview, in pixels: 2:1, sharp at the portal's card size. */
export const PREVIEW_SIZE = { width: 800, height: 400 } as const;

/** The hero still's address under the site's base path. */
export const heroPath = (theme: ThemeName): string => `stills/hero-${theme}.webp`;

/** A lesson preview's address under the site's base path. */
export const previewPath = (image: Lesson['image'], theme: ThemeName): string =>
  `stills/${image}-${theme}.webp`;
