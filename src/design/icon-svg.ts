/**
 * The site's icons as SVG markup, for HTML written outside Preact: the static shell writes them
 * straight into each page, so they show with the first paint. Plain TypeScript, so build scripts
 * can load it too.
 */
import { ICON_PATHS } from './icon-data.ts';

export type IconName = keyof typeof ICON_PATHS;

/** The icons' grid: Phosphor draws on 256 units. */
export const ICON_VIEWBOX = '0 0 256 256';

export function iconSvg(name: IconName, className = 'icon'): string {
  return `<svg class="${className}" viewBox="${ICON_VIEWBOX}" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="${ICON_PATHS[name]}"/></svg>`;
}
