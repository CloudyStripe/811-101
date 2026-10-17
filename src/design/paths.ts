/**
 * How the diorama draws its paths. The shared start is a neutral stone. Both fuel paths are APWA
 * yellow, since natural gas and petroleum share one code, so they're told apart by pattern, shape
 * and icon, never by color: natural gas dashed, a diamond with a flame; gasoline banded, a hexagon
 * with a gas pump. The shared start is solid, a circle with a stack of layers.
 */
import { APWA } from './apwa.ts';
import type { IconName } from './icons.tsx';

/** The shared start, then the two paths it forks into. */
export type PathId = 'shared' | 'gas' | 'gasoline';

export interface PathStyle {
  /** The route's color (sRGB). */
  color: string;
  /** How the route line is drawn along its length, and its stops' markers' rings. */
  pattern: 'solid' | 'dashed' | 'banded';
  /** The shape of its stops' markers, on the model, the map and the step bar. */
  shape: 'circle' | 'diamond' | 'hexagon';
  icon: IconName;
}

/** The shared start's stone: neutral, and quieter than the fuel paths. */
const STONE = '#8e877c';

export const PATH_STYLE: Readonly<Record<PathId, PathStyle>> = {
  shared: { color: STONE, pattern: 'solid', shape: 'circle', icon: 'layers' },
  gas: { color: APWA.yellow.fill, pattern: 'dashed', shape: 'diamond', icon: 'gas' },
  gasoline: { color: APWA.yellow.fill, pattern: 'banded', shape: 'hexagon', icon: 'fuel' },
};
