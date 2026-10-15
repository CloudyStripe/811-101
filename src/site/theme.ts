/** The theme showing, for the 3D pages' code. Browser only: it reads the page and the device. */
import type { ThemeName } from '../design/tokens.ts';

/** The device's own preference, which a chosen theme overrides. Listen to it for changes. */
export const darkQuery = matchMedia('(prefers-color-scheme: dark)');

/** The theme showing: the one chosen in the settings (on <html> as data-theme), or the device's. */
export function resolvedTheme(): ThemeName {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'light' || forced === 'dark') return forced;
  return darkQuery.matches ? 'dark' : 'light';
}
