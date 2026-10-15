/**
 * The ground: the block of rock layers the model is cut from, standing on a floor that runs out
 * to a hazy horizon with low hills; the grass, roads and trees on its top; and the harbor behind
 * it. The layers show on every face of the block, each with its own grain, and an ink line runs
 * along every boundary on the front and back faces, like a section drawing.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShadowMaterial,
  Shape,
  SphereGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  DIORAMA_COLORS as C,
  MATERIAL_COLORS,
  THEMES,
  WORLD_COLORS,
} from '../../../design/tokens.ts';
import { surface, type NoiseOptions } from '../../../kit3d/materials.ts';
import { mulberry32 } from '../../../kit3d/rng.ts';
import { Parts, createFinishes, fixNormals } from './build.ts';
import { tree } from './kit.ts';
import { BACK, BLOCK, BOUNDARIES, FACE, GAS_OIL, HARBOR, OIL_WATER, SITE } from './layout.ts';

export interface Ground {
  group: Group;
  /** The ink lines' color, for the theme. */
  setEdge(hex: string): void;
  /** The floor's color: the page itself, so the model stands on it with no seam. */
  setFloor(hex: string): void;
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

/** A thin ink ribbon along the curve f on a face at z, from x0 to x1. */
function ink(
  f: (x: number) => number,
  x0: number,
  x1: number,
  z: number,
  width = 0.07,
): BufferGeometry {
  const X = xs(x0, x1, 0.6);
  const positions: number[] = [];
  for (let i = 0; i < X.length - 1; i++) {
    const [a, b] = [X[i] ?? x0, X[i + 1] ?? x1];
    const [ya, yb] = [f(a), f(b)];
    const h = width / 2;
    positions.push(
      a,
      ya - h,
      z,
      b,
      yb - h,
      z,
      b,
      yb + h,
      z,
      a,
      ya - h,
      z,
      b,
      yb + h,
      z,
      a,
      ya + h,
      z,
    );
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.computeVertexNormals();
  return g;
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

export function buildGround(): Ground {
  const group = new Group();
  const { x0: X0, x1: X1 } = BLOCK;
  const layer = (hex: string, look?: NoiseOptions): Material =>
    surface(hex, { roughness: 1, ...(look ? { noise: look } : {}) });
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

  // Ink along every boundary on the front and back faces, and around their edges.
  const inkMaterial = new MeshBasicMaterial({ color: new Color(THEMES.light.scene.edge) });
  const inkParts: BufferGeometry[] = [];
  for (const z of [FACE + 0.005, BACK - 0.005]) {
    for (let i = 1; i < BOUNDARIES.length - 1; i++) inkParts.push(ink(BOUNDARY(i), X0, X1, z));
    inkParts.push(
      ink(() => 0, X0, X1, z, 0.1),
      ink(() => BLOCK.bottom, X0, X1, z, 0.1),
    );
    inkParts.push(
      ink(() => GAS_OIL, gx0, gx1, z, 0.04),
      ink(() => OIL_WATER, ox0, ox1, z, 0.04),
    );
  }
  group.add(new Mesh(mergeGeometries(inkParts), inkMaterial));

  // The grass on top.
  add(
    new PlaneGeometry(X1 - X0, BLOCK.z1 - BLOCK.z0).rotateX(-Math.PI / 2).translate(0, 0.001, 0),
    layer(MATERIAL_COLORS.grass, { scale: 2.6, amount: 0.16 }),
  );

  // The floor the block stands on, out to the horizon, in the page's own color.
  const floorMaterial = new MeshBasicMaterial({ color: new Color(THEMES.light.scene.paper) });
  const floor = new Mesh(new PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), floorMaterial);
  floor.position.y = BLOCK.bottom - 0.02;
  // Only the block's shadow shows on it, so the block sits on the page.
  const shadow = new Mesh(
    new PlaneGeometry(240, 200).rotateX(-Math.PI / 2),
    new ShadowMaterial({ opacity: 0.16 }),
  );
  shadow.position.y = BLOCK.bottom - 0.01;
  shadow.receiveShadow = true;
  group.add(floor, shadow);

  // Low hills on the horizon, dissolving into the haze.
  const random = mulberry32(31);
  const hillParts: BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI * 0.95 + (i / 13) * Math.PI * 0.9 + (random() - 0.5) * 0.12;
    const d = 760 + random() * 360;
    const r = 160 + random() * 160;
    hillParts.push(
      new SphereGeometry(r, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2)
        .scale(1, 0.07 + random() * 0.06, 1)
        .translate(Math.cos(a) * d, BLOCK.bottom, Math.sin(a) * d),
    );
  }
  add(mergeGeometries(hillParts), layer(WORLD_COLORS.lawn));

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
    surface(C.sea, { roughness: 0.25, transparent: true, opacity: 0.78 }),
  );
  group.add(sea);

  // The scenery on top: roads, gentle mounds and trees.
  const parts = new Parts(createFinishes());
  parts.box(27.6, 0.05, 2.4, MATERIAL_COLORS.asphalt, 28.2, 0, 11, { cast: false });
  for (let x = 15.5; x < 41.5; x += 2.1)
    parts.box(1.0, 0.02, 0.12, WORLD_COLORS.trim, x, 0.05, 11, { cast: false });
  parts.box(19.6, 0.05, 1.5, MATERIAL_COLORS.concrete, 31.8, 0, SITE.street.z, { cast: false });
  parts.box(1.5, 0.05, 7.8, MATERIAL_COLORS.concrete, 22.5, 0, -5.2, { cast: false });
  for (const [x, z, r] of [
    [-35, -18.5, 5.5],
    [-26.5, -19.4, 4.2],
    [-38.4, -10, 3.2],
  ] as const) {
    parts.dome(r, 0.42, WORLD_COLORS.lawn, x, 0, z, { cast: false, segments: 12 });
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

  return {
    group,
    setEdge(hex) {
      inkMaterial.color.set(hex);
    },
    setFloor(hex) {
      floorMaterial.color.set(hex);
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
