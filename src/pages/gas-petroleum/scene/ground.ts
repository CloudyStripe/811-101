/**
 * The ground: the block of rock layers the model is cut from, floating in the sky; the lawn, roads, paths, shrubs, trees and street lights on its top; and the harbor
 * behind it. The layers show on every face of the block, each with its own grain. The lawn has
 * patches and wears thin around pads, roads and paths, so it never looks mown flat. At night the
 * ground's cover is graded dimmer and cooler, and the lamps throw warm pools of light on it.
 */
import {
  BufferGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  Shape,
  type Material,
} from 'three';
import { DIORAMA_COLORS as C, MATERIAL_COLORS, WORLD_COLORS } from '../../../design/tokens.ts';
import { surface, type GroundRect, type NoiseOptions } from '../../../kit3d/materials.ts';
import { mulberry32 } from '../../../kit3d/rng.ts';
import {
  buildShrubs,
  buildStreetLights,
  type LampSpot,
  type ShrubSpot,
} from '../../../kit3d/world.ts';
import { Parts, createFinishes, fixNormals } from './build.ts';
import { tree } from './kit.ts';
import { BLOCK, BOUNDARIES, GAS_OIL, HARBOR, OIL_WATER, SITE } from './layout.ts';

export interface Ground {
  group: Group;
  /** Lamps: 0 off (day) to 1 fully on (night). */
  setLamps(level: number): void;
}

/** x values from a to b, about `step` apart. */
function xs(a: number, b: number, step = 1.2): number[] {
  const n = Math.max(2, Math.ceil((b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/** The outline of a band between two boundary curves, from x0 to x1. */
function band(
  x0: number,
  x1: number,
  top: (x: number) => number,
  bottom: (x: number) => number,
  step = 1.2,
) {
  const X = xs(x0, x1, step);
  const pts: [number, number][] = X.map((x) => [x, top(x)]);
  for (let i = X.length - 1; i >= 0; i--) {
    const x = X[i] ?? x1;
    pts.push([x, bottom(x)]);
  }
  return pts;
}

/** A band pushed through the block from back to front. */
function slab(points: readonly [number, number][]): BufferGeometry {
  const shape = new Shape();
  const clean = points.filter((p, i) => {
    const prev = points[i - 1];
    return !prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-3;
  });
  const [first, ...rest] = clean;
  if (first) shape.moveTo(first[0], first[1]);
  for (const [x, y] of rest) shape.lineTo(x, y);
  return fixNormals(
    new ExtrudeGeometry(shape, {
      depth: BLOCK.z1 - BLOCK.z0,
      bevelEnabled: false,
      curveSegments: 1,
    }).translate(0, 0, BLOCK.z0),
  );
}

/** Where the curve f crosses level c between a and b. */
function crossing(f: (x: number) => number, c: number, a: number, b: number): number {
  let lo = a;
  let hi = b;
  const below = f(lo) - c > 0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) - c > 0 === below) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const BOUNDARY = (i: number) => BOUNDARIES[i] ?? (() => 0);

/** Each layer's grain: soil and sand fine, rock coarse and pebbled. */
const GRAIN: Record<string, NoiseOptions> = {
  soil: { scale: 0.5, amount: 0.18, pebbles: { scale: 0.35, amount: 0.12 } },
  aquifer: { scale: 0.45, amount: 0.12, pebbles: { scale: 0.3, amount: 0.1 } },
  overburden: { scale: 0.9, amount: 0.12 },
  capRock: { scale: 1.6, amount: 0.1 },
  shale: { scale: 0.6, amount: 0.1 },
  sourceRock: { scale: 1.2, amount: 0.14 },
  basement: { scale: 2.2, amount: 0.16, pebbles: { scale: 1, amount: 0.12 } },
};

/**
 * Strips laid on the lawn, each from point to point and `width` wide: a footpath through the park
 * by the town, and gravel tracks from the separator to the wells.
 */
const PATHS = [
  {
    hex: C.sand,
    width: 0.7,
    points: [
      [23.2, 0.3],
      [21.4, 3.6],
      [20.6, 6.8],
      [21, 9.8],
    ],
  },
  {
    hex: MATERIAL_COLORS.gravel,
    width: 1.1,
    points: [
      [-33.6, 15.2],
      [-34.2, 19],
      [-35, 21.9],
    ],
  },
  {
    hex: MATERIAL_COLORS.gravel,
    width: 1.1,
    points: [
      [-26.8, 15.2],
      [-27.6, 19.2],
      [-28, 22.3],
    ],
  },
] as const;

/**
 * Street lights, lit at night: along both sides of the town's street, along the walk toward the
 * city gate, and one by the gate itself. Each arm reaches over the ground its lamp lights.
 */
const LAMPS: readonly LampSpot[] = [
  { x: 24, z: SITE.street.z - 1.2, facing: Math.PI },
  { x: 32, z: SITE.street.z - 1.2, facing: Math.PI },
  { x: 40, z: SITE.street.z - 1.2, facing: Math.PI },
  { x: 30, z: SITE.street.z + 1.2, facing: 0 },
  { x: 38, z: SITE.street.z + 1.2, facing: 0 },
  { x: 23.7, z: -5.4, facing: Math.PI / 2 },
  { x: 23.7, z: -8.4, facing: Math.PI / 2 },
  { x: SITE.cityGate.x + 2.9, z: SITE.cityGate.z + 2.6, facing: 0.84 },
];

/**
 * The pools the lamps throw at night: spilling past the street onto the lawn, and bright enough to
 * show warm on the moonlit ground.
 */
export const LAMP_POOL = { y: 0.09, radius: 1.6, strength: 0.6 } as const;

/** The roads and walks on the lawn, as rectangles: the grass wears thin along them. */
const ROADS: readonly GroundRect[] = [
  { x0: 14.4, x1: 42, z0: 9.8, z1: 12.2 },
  { x0: 22, x1: 41.6, z0: SITE.street.z - 0.75, z1: SITE.street.z + 0.75 },
  { x0: 21.75, x1: 23.25, z0: -9.1, z1: -1.3 },
];

/** The rectangle around a path's straight stretch, for wearing the grass along it. */
function stretchRect(a: readonly [number, number], b: readonly [number, number], width: number) {
  const pad = width / 2;
  return {
    x0: Math.min(a[0], b[0]) - pad,
    x1: Math.max(a[0], b[0]) + pad,
    z0: Math.min(a[1], b[1]) - pad,
    z1: Math.max(a[1], b[1]) + pad,
  };
}

/** The ground and its scenery. The grass wears thin around `pads`, the stops' pads on it. */
export function buildGround(pads: readonly GroundRect[] = []): Ground {
  const group = new Group();
  const { x0: X0, x1: X1 } = BLOCK;
  const layer = (hex: string, look?: NoiseOptions): Material =>
    surface(hex, { finish: 'matte', roughness: 1, ...(look ? { noise: look } : {}) });
  const add = (geometry: BufferGeometry, material: Material, cast = false) => {
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    group.add(mesh);
    return mesh;
  };

  // The layers, top to bottom, through the whole block.
  const layers: [string, number, number, string][] = [
    ['soil', 0, 1, C.soil],
    ['aquifer', 1, 2, C.aquifer],
    ['overburden', 2, 3, C.overburden],
    ['capRock', 3, 4, C.capRock],
    ['shale', 5, 6, C.shale],
    ['sourceRock', 6, 7, C.sourceRock],
    ['basement', 7, 8, C.basement],
  ];
  for (const [name, a, b, hex] of layers) {
    add(slab(band(X0, X1, BOUNDARY(a), BOUNDARY(b))), layer(hex, GRAIN[name]), true);
  }
  // The reservoir rock, its pores filled by weight: gas on top, then oil, then salty water.
  const top = BOUNDARY(4);
  const bottom = BOUNDARY(5);
  const gx0 = crossing(top, GAS_OIL, -42, -28);
  const gx1 = crossing(top, GAS_OIL, -28, 0);
  const ox0 = crossing(top, OIL_WATER, -42, -28);
  const ox1 = crossing(top, OIL_WATER, -28, 0);
  add(
    slab(band(gx0, gx1, top, () => GAS_OIL, 0.6)),
    layer(C.gasZone, { scale: 0.4, amount: 0.08 }),
  );
  add(
    slab(
      band(
        ox0,
        ox1,
        (x) => Math.min(top(x), GAS_OIL),
        () => OIL_WATER,
        0.6,
      ),
    ),
    layer(C.oilZone, { scale: 0.4, amount: 0.1 }),
  );
  add(
    slab(band(X0, X1, (x) => Math.min(top(x), OIL_WATER), bottom, 0.6)),
    layer(C.waterZone, { scale: 0.4, amount: 0.12, pebbles: { scale: 0.3, amount: 0.1 } }),
  );

  // The lawn on top: patches, and worn grass around the pads, roads and paths.
  const worn = [
    ...pads,
    ...ROADS,
    ...PATHS.flatMap((p) =>
      p.points.slice(1).map((b, i) => stretchRect(p.points[i] ?? b, b, p.width)),
    ),
  ];
  add(
    new PlaneGeometry(X1 - X0, BLOCK.z1 - BLOCK.z0).rotateX(-Math.PI / 2).translate(0, 0.001, 0),
    surface(MATERIAL_COLORS.grass, {
      finish: 'matte',
      roughness: 1,
      ground: true,
      noise: {
        scale: 2.6,
        amount: 0.12,
        lawn: {
          patch: { hex: MATERIAL_COLORS.grassPatch, scale: 4.5, share: 0.8 },
          worn: { hex: MATERIAL_COLORS.grassWorn, width: 0.7, around: worn },
        },
      },
    }),
  );

  // No floor, and nothing under the block to catch a shadow: the block floats in the sky, which no
  // shadow of it or its buildings falls across.

  // The harbor behind the block: the seabed, and the sea over it.
  const harborW = HARBOR.x1 - HARBOR.x0;
  const harborD = HARBOR.z1 - HARBOR.z0;
  const harborX = (HARBOR.x0 + HARBOR.x1) / 2;
  const harborZ = (HARBOR.z0 + HARBOR.z1) / 2;
  const seabedTop = -3.2;
  add(
    slabBox(harborW, seabedTop - BLOCK.bottom, harborD, harborX, BLOCK.bottom, harborZ),
    layer(C.seabed, { scale: 0.5, amount: 0.14 }),
    true,
  );
  const sea = new Mesh(
    slabBox(harborW, HARBOR.water - seabedTop, harborD, harborX, seabedTop, harborZ),
    surface(C.sea, { roughness: 0.25, transparent: true, opacity: 0.88 }),
  );
  group.add(sea);

  // The scenery on top: roads, paths, gentle mounds, trees and shrubs, all the ground's cover.
  const parts = new Parts(createFinishes());
  const flat = { cast: false, finish: 'ground' } as const;
  parts.box(27.6, 0.05, 2.4, MATERIAL_COLORS.asphalt, 28.2, 0, 11, flat);
  for (let x = 15.5; x < 41.5; x += 2.1)
    parts.box(1.0, 0.02, 0.12, WORLD_COLORS.trim, x, 0.05, 11, flat);
  parts.box(19.6, 0.05, 1.5, MATERIAL_COLORS.concrete, 31.8, 0, SITE.street.z, flat);
  parts.box(1.5, 0.05, 7.8, MATERIAL_COLORS.concrete, 22.5, 0, -5.2, flat);
  for (const p of PATHS) {
    p.points.slice(1).forEach((b, i) => {
      const a = p.points[i] ?? b;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // Each stretch runs on a little into the next, so the corners close.
      parts.box(
        p.width,
        0.03,
        length + p.width * 0.8,
        p.hex,
        (a[0] + b[0]) / 2,
        0,
        (a[1] + b[1]) / 2,
        {
          ...flat,
          ry: Math.atan2(b[0] - a[0], b[1] - a[1]),
        },
      );
    });
  }
  for (const [x, z, r] of [
    [-35, -18.5, 5.5],
    [-26.5, -19.4, 4.2],
    [-38.4, -10, 3.2],
  ] as const) {
    parts.dome(r, 0.42, WORLD_COLORS.lawn, x, 0, z, { ...flat, segments: 16 });
  }
  const trees = [
    [-38, -14, 1.2],
    [-31, -22, 1],
    [-22, -17, 1.1],
    [-24.5, -13.5, 0.9],
    [-39.5, -4, 1],
    [-34.5, -1.5, 0.9],
    [-40, 5, 1.1],
    [-37.5, 8.6, 0.8],
    [-17, 3, 1],
    [-12.5, 5.5, 0.9],
    [-8.5, 3.2, 1.1],
    [-3.5, -3.5, 1],
    [2.5, -4.5, 0.9],
    [8.5, -3.2, 1.1],
    [11.5, 1.5, 0.9],
    [3.2, 3.5, 0.8],
    [-9, -20.5, 1.1],
    [-3.5, -21.5, 1],
    [1.5, -19.5, 0.9],
    [10.5, -16.5, 0.8],
    [41, -5.6, 0.9],
    [41, 5.5, 1],
    [26, 6.6, 0.8],
    [33.6, 6.2, 0.9],
    [40.5, 15.5, 1.1],
    [37.8, 21.6, 1],
    [34.6, 17.4, 0.9],
    [-1.5, 21.5, 1],
    [3.5, 21.8, 0.9],
    [8.5, 21.6, 1.1],
    [-16.5, 9.6, 0.9],
    [-36, 15.6, 0.9],
    [-2.6, 6.4, 0.9],
    [13.6, -3.6, 0.8],
    [28.6, -8.6, 0.8],
    [36.8, -8.8, 0.9],
  ] as const;
  trees.forEach(([x, z, s], i) => {
    tree(parts, x, z, s, i % 3 === 2 ? WORLD_COLORS.foliageDark : WORLD_COLORS.foliage);
  });
  group.add(parts.finish());

  // Shrubs at the trees' feet, in ones and twos, where the lawn is known to be clear.
  const rand = mulberry32(57);
  const shrubs: ShrubSpot[] = trees.flatMap(([x, z, s]) =>
    Array.from({ length: Math.floor(rand() * 2.4) }, () => {
      const a = rand() * Math.PI * 2;
      const r = (1.1 + rand() * 0.5) * s;
      return { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, size: (0.7 + rand() * 0.5) * s };
    }),
  );
  group.add(buildShrubs(shrubs, WORLD_COLORS));

  // Street lights at the scale of the homes.
  const lamps = buildStreetLights(LAMPS, WORLD_COLORS, {
    height: 2.2,
    reach: 0.45,
    size: 0.11,
    pool: LAMP_POOL,
  });
  group.add(lamps.group);

  return {
    group,
    setLamps(level) {
      lamps.setLamps(level);
    },
  };
}

/** A box w by h by d whose base sits at y, centered on x and z. */
function slabBox(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, h);
  shape.lineTo(-w / 2, h);
  return new ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }).translate(x, y, z - d / 2);
}
