/**
 * The house and its garage, with their windows, door and chimney, and the trees and shrubs around
 * them. All in neutrals (palette.ts): nothing here may read as a mark. Lit windows glow at night,
 * a dim lamplight well under bloom.
 */
import {
  DoubleSide,
  Group,
  Mesh,
  Shape,
  ShapeGeometry,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
} from 'three';
import { WORLD_COLORS } from '../../../design/tokens.ts';
import { merge, roundedBox } from '../../../kit3d/geometry.ts';
import { surface } from '../../../kit3d/materials.ts';
import { buildShrubs, buildTrees } from '../../../kit3d/world.ts';
import { FIXTURES, GARAGE, HOUSE } from './layout.ts';
import { WINDOW_LIT, YARD_COLORS as Y } from './palette.ts';

function mesh(geometry: BufferGeometry, material: Material, cast = true): Mesh {
  const m = new Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

interface Footprint {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  wall: number;
  ridge: number;
}

/** A gable roof along x, its eaves out past the walls, and the gable ends under it. */
function gable(b: Footprint): { roof: BufferGeometry; ends: BufferGeometry } {
  const over = 0.8;
  const zm = (b.z0 + b.z1) / 2;
  const eave = b.wall - 0.4;
  const run = zm - (b.z0 - over);
  const rise = b.ridge - eave;
  const slope = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  const slopes = ([-1, 1] as const).map((side) =>
    roundedBox(b.x1 - b.x0 + 2 * over, 0.45, slope + 0.2, 0.12, [0, 0, 0], 2)
      .rotateX(side * angle)
      .translate((b.x0 + b.x1) / 2, (eave + b.ridge) / 2, zm + (side * run) / 2),
  );
  const tri = new Shape();
  tri.moveTo(b.z0, b.wall);
  tri.lineTo(zm, b.ridge - 0.5);
  tri.lineTo(b.z1, b.wall);
  tri.closePath();
  const end = new ShapeGeometry(tri).rotateY(-Math.PI / 2);
  return {
    roof: merge(slopes),
    ends: merge([end.clone().translate(b.x0 + 0.01, 0, 0), end.translate(b.x1 - 0.01, 0, 0)]),
  };
}

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r = 0.06) =>
  roundedBox(x1 - x0, y1 - y0, z1 - z0, r, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], 2);

export interface Buildings {
  group: Group;
  /** Lights the windows, from 0 (day) to 1 (night). */
  setLamps(level: number): void;
}

export function buildBuildings(): Buildings {
  const group = new Group();
  group.name = 'buildings';
  const walls = surface(Y.walls, { finish: 'paint' });
  const ends = surface(Y.walls, { finish: 'paint', side: DoubleSide });
  const roof = surface(Y.roof, { finish: 'matte' });
  const trim = surface(Y.trim, { finish: 'paint' });
  const glass: MeshStandardMaterial = surface(Y.glass, { finish: 'paint', emissive: Y.glassLit });
  glass.emissiveIntensity = 0;
  for (const b of [HOUSE, GARAGE]) {
    group.add(mesh(box(b.x0, b.x1, 0, b.wall, b.z0, b.z1, 0.25), walls));
    const g = gable(b);
    group.add(mesh(g.roof, roof), mesh(g.ends, ends));
  }
  // The front: windows in their frames, the door and its step, the garage door, the chimney.
  const front = HOUSE.z1 + 0.06;
  const panes: BufferGeometry[] = [];
  const frames: BufferGeometry[] = [];
  for (const x of [-19.6, -11.6, 3]) {
    panes.push(box(x - 1.9, x + 1.9, 3.2, 7.2, front - 0.1, front + 0.08, 0.05));
    frames.push(box(x - 2.15, x + 2.15, 2.95, 7.45, front - 0.12, front + 0.04, 0.06));
  }
  group.add(mesh(merge(frames), trim), mesh(merge(panes), glass, false));
  group.add(
    mesh(
      box(-3.6, -0.8, 0.3, 7.2, front - 0.1, front + 0.12, 0.08),
      surface(Y.door, { finish: 'paint' }),
    ),
    mesh(
      box(-4.8, 0.4, 0, 0.35, front, front + 2.4, 0.1),
      surface(Y.concrete, { finish: 'matte' }),
    ),
    mesh(
      box(GARAGE.x0 + 1.6, GARAGE.x1 - 1.6, 0.2, 7.4, GARAGE.z1 - 0.05, GARAGE.z1 + 0.1, 0.08),
      surface(Y.garageDoor, { finish: 'paint' }),
    ),
    mesh(box(-2, 0.6, 11, 16.5, -38, -35.6, 0.12), surface(Y.chimney, { finish: 'matte' })),
  );
  // Trees and shrubs, in their own greens, clear of the meters and the lines' ends.
  const palette = { ...WORLD_COLORS };
  const meters = [FIXTURES.gasMeter.x, FIXTURES.electricMeter.x, FIXTURES.terminal.x];
  const shrubs = [-20.8, -14, -9.4, -3.8, 2.6, 8.6]
    .filter((x) => meters.every((m) => Math.abs(m - x) > 2.2))
    .map((x, i) => ({ x, z: HOUSE.z1 + 1.4, size: 2.2 + (i % 3) * 0.5 }));
  group.add(
    buildTrees(
      [
        { x: -28, z: -38, height: 19 },
        { x: 28, z: -30, height: 16 },
        { x: 27, z: -42, height: 15 },
      ],
      palette,
    ),
    buildShrubs(shrubs, palette),
  );
  return {
    group,
    setLamps(level) {
      glass.color.set(level > 0.5 ? Y.glassLit : Y.glass);
      glass.emissiveIntensity = WINDOW_LIT * level;
    },
  };
}
