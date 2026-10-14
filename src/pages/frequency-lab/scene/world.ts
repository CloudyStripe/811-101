/**
 * The neighborhood around the block: homes and trees across the street, street lights along the
 * far sidewalk, cross streets at both ends, and lawns out to the horizon. Seeded, so every visit
 * and every screenshot match. Nothing here carries meaning: it's quiet scenery that tells you
 * where you are.
 */
import { Group } from 'three';
import { WORLD_COLORS, type SceneTokens } from '../../../design/tokens.ts';
import { mulberry32 } from '../../../kit3d/rng.ts';
import {
  buildHomes,
  buildStreetLights,
  buildTrees,
  contactShadow,
  groundPlane,
  type HomeSpot,
  type LampSpot,
  type TreeSpot,
} from '../../../kit3d/world.ts';
import {
  BLOCK,
  CROSS_STREETS,
  GROUND,
  SCENERY_END,
  SURFACE,
  WORLD,
  inCrossStreet,
  spansBetween,
} from './layout.ts';

export interface Neighborhood {
  readonly group: Group;
  /** Day or night: lamps and windows, and the section's shadow on its paper. */
  setTheme(tokens: SceneTokens): void;
}

/** Front yards and side yards keep homes this far from a cross street's edge. */
const CORNER_YARD = 8;

export function buildNeighborhood(): Neighborhood {
  const rand = mulberry32(2026);
  const group = new Group();
  group.name = 'neighborhood';

  // Lawns behind the block, out past where the fog closes in, with the cross streets cut out.
  group.add(
    groundPlane(
      spansBetween(GROUND.x0, GROUND.x1, CROSS_STREETS).map((s) => ({
        x0: s.x0,
        x1: s.x1,
        z0: GROUND.z0,
        z1: BLOCK.z0,
      })),
      0.1,
      WORLD_COLORS.lawn,
      { scale: 9, amount: 0.1 },
    ),
  );
  // In front of the cut, the section stands on paper, like a model on a drafting table: the sky
  // below the horizon is the page's own color. A soft shadow along the section's foot grounds it.
  const foot = contactShadow(WORLD.x0, WORLD.x1, BLOCK.z1, BLOCK.bottom + 0.03, 3.2);
  group.add(foot.mesh);

  // Homes across the street, facing it, behind deep front yards; a second row further back. The
  // lawn straight across from the camera stays open, so no home looms over the block.
  const homes: HomeSpot[] = [];
  const trees: TreeSpot[] = [];
  const row = (setback: number, gapMin: number, start: number) => {
    for (let x = start; x < SCENERY_END;) {
      const width = 24 + rand() * 12;
      const depth = 22 + rand() * 8;
      // Homes face the main street and keep their yards clear of the cross streets.
      const corner = CROSS_STREETS.find(
        (c) => x < c.x1 + CORNER_YARD && x + width > c.x0 - CORNER_YARD,
      );
      if (corner) {
        x = corner.x1 + CORNER_YARD;
        continue;
      }
      homes.push({
        x: x + width / 2,
        z: BLOCK.z0 - setback - depth / 2 - rand() * 6,
        width,
        depth,
        // Mostly single-story, so the homes sit low behind the block.
        stories: rand() < 0.25 ? 2 : 1,
        rotation: (rand() - 0.5) * 0.04,
      });
      const gap = gapMin + rand() * 18;
      // A tree or two in the side yard.
      trees.push({
        x: x + width + gap / 2,
        z: BLOCK.z0 - setback - 4 - rand() * 14,
        height: 24 + rand() * 14,
      });
      if (rand() < 0.5) {
        trees.push({
          x: x + rand() * width,
          z: BLOCK.z0 - setback - depth - 14 - rand() * 10,
          height: 26 + rand() * 12,
        });
      }
      x += width + gap;
    }
  };
  row(52, 16, 34);
  row(130, 26, -40);
  for (const x of [-82, -26, -10]) {
    trees.push({ x: x + rand() * 8, z: BLOCK.z0 - 30 - rand() * 30, height: 28 + rand() * 10 });
  }

  // Street trees on the near verge, well away from the hookup and the lines' labels.
  for (let x = BLOCK.x1 + 70; x < SCENERY_END; x += 55 + rand() * 30) {
    trees.push({ x, z: SURFACE.vergeBack / 2 - 0.5, height: 20 + rand() * 8 });
  }
  for (let x = BLOCK.x0 - 50; x > WORLD.x0; x -= 50 + rand() * 30) {
    trees.push({ x, z: SURFACE.vergeBack / 2 - 0.5, height: 20 + rand() * 8 });
  }

  // Street lights on the far sidewalk, their arms reaching out over the street.
  const lamps: LampSpot[] = [];
  for (let x = WORLD.x0 + 30; x < SCENERY_END; x += 118) {
    if (inCrossStreet(x, 2)) continue;
    lamps.push({ x, z: (SURFACE.farCurbBack + SURFACE.sidewalkBack) / 2, facing: Math.PI });
  }

  const homeScenery = buildHomes(homes, WORLD_COLORS);
  const lights = buildStreetLights(lamps, WORLD_COLORS);
  group.add(
    homeScenery.group,
    // No trunk stands in a cross street.
    buildTrees(
      trees.filter((t) => !inCrossStreet(t.x, 3)),
      WORLD_COLORS,
    ),
    lights.group,
  );

  return {
    group,
    setTheme(tokens) {
      homeScenery.setLamps(tokens.lamps);
      lights.setLamps(tokens.lamps);
      foot.setStrength(0.22 + 0.2 * tokens.lamps);
    },
  };
}
