/**
 * The scenery on the slab: a few small trees and shrubs on the far lawn, two street lights on the
 * far sidewalk for the night, and a soft shadow along the foot of the cut face. Small and quiet,
 * so the cut face leads; nothing here carries meaning.
 */
import { Group } from 'three';
import { WORLD_COLORS, type SceneTokens } from '../../../design/tokens.ts';
import { buildShrubs, buildStreetLights, buildTrees, contactShadow } from '../../../kit3d/world.ts';
import type { LabLayout } from './layout.ts';

export interface Scenery {
  readonly group: Group;
  /** Day or night: the lamps, and the shadow at the slab's foot. */
  setTheme(tokens: SceneTokens): void;
}

export function buildScenery(layout: LabLayout): Scenery {
  const { block } = layout;
  const group = new Group();
  group.name = 'scenery';
  const foot = contactShadow(block.x0, block.x1, block.z1, block.bottom + 0.03, 4);
  const lights = buildStreetLights(
    layout.lamps.map((l) => ({ ...l, facing: Math.PI })),
    WORLD_COLORS,
    // Low, like the trees, so the cut face stays the biggest thing in view.
    { height: 14, reach: 3, pool: { y: 0.1, radius: 5, strength: 0.26 } },
  );
  group.add(
    foot.mesh,
    buildTrees(layout.trees, WORLD_COLORS),
    buildShrubs(layout.shrubs, WORLD_COLORS),
    lights.group,
  );
  return {
    group,
    setTheme(tokens) {
      lights.setLamps(tokens.lamps);
      foot.setStrength(0.3 + 0.2 * tokens.lamps);
    },
  };
}
