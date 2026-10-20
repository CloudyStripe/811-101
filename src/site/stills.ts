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

/**
 * Where the portal's hero stacks (phones, upright tablets, short screens): the name and its line
 * over the cards, with no model beside them, so its still is never fetched. portal.css uses the
 * same query.
 */
export const HERO_STACKS =
  '(max-width: 760px), (max-width: 1023px) and (orientation: portrait), (max-height: 500px)';

/**
 * How wide a picture's placeholder is, in pixels: a tiny copy, inline in the page (a wide loader
 * poster's, twice that).
 */
export const PLACEHOLDER_WIDTH = 48;

/** The hero still's address under the site's base path. */
export const heroPath = (theme: ThemeName): string => `stills/hero-${theme}.webp`;

/** A lesson preview's address under the site's base path. */
export const previewPath = (image: Lesson['image'], theme: ThemeName): string =>
  `stills/${image}-${theme}.webp`;
