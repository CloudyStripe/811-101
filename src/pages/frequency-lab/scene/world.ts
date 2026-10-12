/**
 * The neighborhood around the block: homes and trees across the street, street lights along the
 * far sidewalk, and lawns out to the horizon. Seeded, so every visit and every screenshot match.
 * Nothing here carries meaning: it's quiet scenery that tells you where you are.
 */
import { Group, type Mesh, type MeshStandardMaterial } from 'three';
import { WORLD_COLORS, type SceneTokens } from '../../../design/tokens.ts';
import { mulberry32 } from '../../../kit3d/rng.ts';
import {
  buildHomes,
  buildStreetLights,
  buildTrees,
  groundPlane,
  type HomeSpot,
  type LampSpot,
  type TreeSpot,
} from '../../../kit3d/world.ts';
import { BLOCK, SURFACE, WORLD } from './layout.ts';

export interface Neighborhood {
  readonly group: Group;
  /** Day or night: lamps and windows, and the paper the section stands on. */
  setTheme(tokens: SceneTokens): void;
}

export function buildNeighborhood(): Neighborhood {
  const rand = mulberry32(2026);
  const group = new Group();
  group.name = 'neighborhood';

  // Lawns behind the block, out past where the fog closes in.
  group.add(
    groundPlane({ x0: -900, x1: 1300, z0: -900, z1: BLOCK.z0 }, 0.1, WORLD_COLORS.lawn, {
      scale: 9,
      amount: 0.1,
    }),
  );
  // In front of the cut, the section stands on paper, like a model on a drafting table.
  const paper: Mesh = groundPlane(
    { x0: WORLD.x0 - 400, x1: WORLD.x1 + 400, z0: BLOCK.z1, z1: 600 },
    BLOCK.bottom,
    '#ffffff',
  );
  paper.name = 'paper';
  group.add(paper);

  // Homes across the street, facing it, behind deep front yards; a second row further back. The
  // lawn straight across from the camera stays open, so no home looms over the block.
  const homes: HomeSpot[] = [];
  const trees: TreeSpot[] = [];
  const row = (setback: number, gapMin: number, start: number) => {
    for (let x = start; x < WORLD.x1 + 200;) {
      const width = 24 + rand() * 12;
      const depth = 22 + rand() * 8;
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
  for (const x of [-62, -38, -14]) {
    trees.push({ x: x + rand() * 8, z: BLOCK.z0 - 30 - rand() * 30, height: 28 + rand() * 10 });
  }

  // Street trees on the near verge, well away from the hookup and the lines' labels.
  for (let x = BLOCK.x1 + 70; x < WORLD.x1; x += 55 + rand() * 30) {
    trees.push({ x, z: SURFACE.vergeBack / 2 - 0.5, height: 20 + rand() * 8 });
  }
  for (let x = BLOCK.x0 - 50; x > WORLD.x0; x -= 50 + rand() * 30) {
    trees.push({ x, z: SURFACE.vergeBack / 2 - 0.5, height: 20 + rand() * 8 });
  }

  // Street lights on the far sidewalk, their arms reaching out over the street.
  const lamps: LampSpot[] = [];
  for (let x = WORLD.x0 + 30; x < WORLD.x1; x += 118) {
    lamps.push({ x, z: (SURFACE.farCurbBack + SURFACE.sidewalkBack) / 2, facing: Math.PI });
  }

  const homeScenery = buildHomes(homes, WORLD_COLORS);
  const lights = buildStreetLights(lamps, WORLD_COLORS);
  group.add(homeScenery.group, buildTrees(trees, WORLD_COLORS), lights.group);

  return {
    group,
    setTheme(tokens) {
      homeScenery.setLamps(tokens.lamps);
      lights.setLamps(tokens.lamps);
      (paper.material as MeshStandardMaterial).color.set(tokens.paper);
    },
  };
}
