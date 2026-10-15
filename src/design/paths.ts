/**
 * How the diorama draws its routes. The shared start is a neutral stone. Both fuel paths are APWA
 * yellow, since natural gas and petroleum share one code, so they're told apart by pattern and
 * icon, never by color: natural gas dashed, with a flame; gasoline banded, with a fuel can.
 */
import { APWA } from './apwa.ts';
import type { IconName } from './icons.tsx';

/** The shared start, then the two paths it forks into. */
export type PathId = 'shared' | 'gas' | 'gasoline';

export interface PathStyle {
  /** The route's color (sRGB). */
  color: string;
  /** How the route line is drawn along its length. */
  pattern: 'solid' | 'dashed' | 'banded';
  icon: IconName;
}

/** The shared start's stone: neutral, and quieter than the fuel paths. */
const STONE = '#8e877c';

export const PATH_STYLE: Readonly<Record<PathId, PathStyle>> = {
  shared: { color: STONE, pattern: 'solid', icon: 'layers' },
  gas: { color: APWA.yellow.fill, pattern: 'dashed', icon: 'gas' },
  gasoline: { color: APWA.yellow.fill, pattern: 'banded', icon: 'fuel' },
};
