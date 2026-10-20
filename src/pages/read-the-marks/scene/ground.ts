/**
 * The yard's ground: the soil block and its strata, and what covers it (the lawn, the sidewalk, the
 * grass strip, the driveway, the curb and the street). It's built for the lines whose ground is
 * open: cut along each of them, with what was in each cut kept apart as its lid (the cover over
 * the line and the soil down to just below it), which slides aside as the ground opens and back as
 * it closes. With nothing open the ground is built whole, its edges soft and unbroken, so nothing
 * gives a line away before it's asked about.
 */
import { Group, Mesh, type BufferGeometry, type Material } from 'three';
import { MATERIAL_COLORS as C } from '../../../design/tokens.ts';
import { merge, roundedBox } from '../../../kit3d/geometry.ts';
import { surface, type GroundRect } from '../../../kit3d/materials.ts';
import type { MarkId } from '../game.ts';
import {
  BANDS,
  BLOCK,
  DRIVEWAY,
  GARAGE,
  HOUSE,
  MARKS,
  TOPS,
  asideOf,
  cutsOf,
  runsAlongZ,
  segmentsOf,
  type Box,
  type Point,
} from './layout.ts';
import { YARD_COLORS as Y } from './palette.ts';

export type Cover =
  'grass' | 'concrete' | 'curb' | 'asphalt' | 'topsoil' | 'subsoil' | 'clay' | 'rock';

interface Piece extends Box {
  cover: Cover;
  /** How round its edges are. */
  radius: number;
}

/** The strata, top to bottom. */
const STRATA: readonly { cover: Cover; top: number; bottom: number }[] = [
  { cover: 'topsoil', top: 0, bottom: -1.6 },
  { cover: 'subsoil', top: -1.6, bottom: -5.2 },
  { cover: 'clay', top: -5.2, bottom: -9 },
  { cover: 'rock', top: -9, bottom: BLOCK.bottom },
];

/** Where the lawn wears thin: along the sidewalk, the house and garage, and the driveway. */
const WORN: readonly GroundRect[] = [
  { x0: BLOCK.x0, x1: BLOCK.x1, z0: BANDS.sidewalkBack - 0.2, z1: BANDS.sidewalkBack },
  { x0: HOUSE.x0, x1: GARAGE.x1, z0: HOUSE.z0, z1: HOUSE.z1 + 0.6 },
  { x0: DRIVEWAY.x0, x1: DRIVEWAY.x1, z0: GARAGE.z1, z1: BANDS.sidewalkBack },
  { x0: BLOCK.x0, x1: BLOCK.x1, z0: BANDS.sidewalkFront, z1: BANDS.sidewalkFront + 0.2 },
];

/** The ground, whole: the strata through the block, then what covers it. */
function wholeGround(): Piece[] {
  const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = BLOCK;
  const pieces: Piece[] = STRATA.map((s) => ({
    cover: s.cover,
    radius: 0.04,
    x0: X0,
    x1: X1,
    y0: s.bottom,
    y1: s.top,
    z0: Z0,
    z1: Z1,
  }));
  const add = (cover: Cover, radius: number, b: Box) => pieces.push({ cover, radius, ...b });
  const g = TOPS.grass;
  // The lawn, either side of the driveway, and behind the garage.
  add('grass', 0.06, { x0: X0, x1: DRIVEWAY.x0, y0: 0, y1: g, z0: Z0, z1: BANDS.sidewalkBack });
  add('grass', 0.06, { x0: DRIVEWAY.x1, x1: X1, y0: 0, y1: g, z0: Z0, z1: BANDS.sidewalkBack });
  add('grass', 0.06, { x0: DRIVEWAY.x0, x1: DRIVEWAY.x1, y0: 0, y1: g, z0: Z0, z1: GARAGE.z0 });
  // The driveway, from the garage to the sidewalk, and its apron across the grass strip.
  add('concrete', 0.1, {
    x0: DRIVEWAY.x0,
    x1: DRIVEWAY.x1,
    y0: 0,
    y1: TOPS.driveway,
    z0: GARAGE.z1,
    z1: BANDS.sidewalkBack - 0.03,
  });
  add('concrete', 0.1, {
    x0: DRIVEWAY.x0,
    x1: DRIVEWAY.x1,
    y0: -0.02,
    y1: TOPS.apron,
    z0: BANDS.sidewalkFront + 0.03,
    z1: BANDS.gutterFront,
  });
  // The sidewalk, in 5 ft panels with tooled joints.
  for (let x = X0; x < X1 - 0.1; x += 5) {
    add('concrete', 0.06, {
      x0: x + 0.03,
      x1: Math.min(x + 5, X1) - 0.03,
      y0: 0,
      y1: TOPS.sidewalk,
      z0: BANDS.sidewalkBack,
      z1: BANDS.sidewalkFront,
    });
  }
  // The grass strip, and the curb in front of it, either side of the apron.
  for (const [a, b] of [
    [X0, DRIVEWAY.x0],
    [DRIVEWAY.x1, X1],
  ] as const) {
    add('grass', 0.06, {
      x0: a,
      x1: b,
      y0: 0,
      y1: g,
      z0: BANDS.sidewalkFront,
      z1: BANDS.stripFront,
    });
    add('curb', 0.14, {
      x0: a,
      x1: b,
      y0: 0,
      y1: TOPS.curb,
      z0: BANDS.stripFront,
      z1: BANDS.curbFront,
    });
  }
  // The gutter and the street.
  add('concrete', 0.1, {
    x0: X0,
    x1: X1,
    y0: -0.06,
    y1: TOPS.gutter,
    z0: BANDS.curbFront,
    z1: BANDS.gutterFront,
  });
  add('asphalt', 0.06, {
    x0: X0,
    x1: X1,
    y0: -0.12,
    y1: TOPS.street,
    z0: BANDS.gutterFront,
    z1: Z1,
  });
  return pieces;
}

const hits = (b: Box, h: Box) =>
  h.x0 < b.x1 && h.x1 > b.x0 && h.y0 < b.y1 && h.y1 > b.y0 && h.z0 < b.z1 && h.z1 > b.z0;

const big = (b: Box) => b.x1 - b.x0 > 0.01 && b.y1 - b.y0 > 0.005 && b.z1 - b.z0 > 0.01;

/** A box less what's inside each hole: up to five boxes for each hole it meets. */
export function carve(box: Box, holes: readonly Box[]): Box[] {
  let parts: Box[] = [box];
  for (const h of holes) {
    const next: Box[] = [];
    for (const b of parts) {
      if (!hits(b, h)) {
        next.push(b);
        continue;
      }
      if (b.x0 < h.x0) next.push({ ...b, x1: h.x0 });
      if (b.x1 > h.x1) next.push({ ...b, x0: h.x1 });
      const x0 = Math.max(b.x0, h.x0);
      const x1 = Math.min(b.x1, h.x1);
      if (b.z0 < h.z0) next.push({ ...b, x0, x1, z1: h.z0 });
      if (b.z1 > h.z1) next.push({ ...b, x0, x1, z0: h.z1 });
      const z0 = Math.max(b.z0, h.z0);
      const z1 = Math.min(b.z1, h.z1);
      if (b.y0 < h.y0) next.push({ ...b, x0, x1, z0, z1, y1: h.y0 });
      if (b.y1 > h.y1) next.push({ ...b, x0, x1, z0, z1, y0: h.y1 });
    }
    parts = next.filter(big);
  }
  return parts;
}

/** What two boxes share, if anything. */
export function intersect(a: Box, b: Box): Box | null {
  const box = {
    x0: Math.max(a.x0, b.x0),
    x1: Math.min(a.x1, b.x1),
    y0: Math.max(a.y0, b.y0),
    y1: Math.min(a.y1, b.y1),
    z0: Math.max(a.z0, b.z0),
    z1: Math.min(a.z1, b.z1),
  };
  return big(box) ? box : null;
}

function slab(b: Box, radius: number): BufferGeometry {
  const r = Math.min(radius, 0.45 * Math.min(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0));
  return roundedBox(
    b.x1 - b.x0,
    b.y1 - b.y0,
    b.z1 - b.z0,
    r,
    [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2],
    1,
  );
}

/** The ground's materials, shared by the ground as built for any lines open, and its lids. */
export function groundMaterials(): Record<Cover, Material> {
  const strata = (hex: string, scale: number, amount: number) =>
    surface(hex, {
      finish: 'matte',
      roughness: 1,
      noise: { scale, amount, pebbles: { scale: scale * 0.6, amount: 0.15 } },
    });
  return {
    grass: surface(C.grass, {
      finish: 'matte',
      roughness: 1,
      noise: {
        scale: 2.6,
        amount: 0.12,
        lawn: {
          patch: { hex: C.grassPatch, scale: 9, share: 0.8 },
          worn: { hex: Y.grassWorn, width: 1.2, around: WORN },
        },
      },
    }),
    concrete: surface(Y.concrete, { noise: { scale: 3, amount: 0.06 } }),
    curb: surface(Y.curb, { noise: { scale: 2.5, amount: 0.05 } }),
    asphalt: surface(C.asphalt, {
      finish: 'matte',
      roughness: 0.95,
      noise: { scale: 0.7, amount: 0.12 },
    }),
    topsoil: strata(C.topsoil, 0.9, 0.16),
    subsoil: strata(C.subsoil, 1.4, 0.13),
    clay: strata(C.clay, 2.8, 0.08),
    rock: strata(C.rock, 3.6, 0.12),
  };
}

/** One cut's lid: what was in it, which slides aside to open the ground. */
export interface Lid {
  mark: MarkId;
  /** Its run's index along the line. */
  run: number;
  group: Group;
  /** Which way it slides, in the ground's plane. */
  aside: Point;
  /** How far it slides, to be out of the way: the cut's width, and a little more. */
  reach: number;
  /** The cut itself, for what rides on the lid (paint) or steps off it (flags). */
  cut: Box;
}

export interface Ground {
  group: Group;
  lids: Lid[];
  dispose(): void;
}

/** The cuts of every line whose ground is open, with what each belongs to. */
export function cutsFor(open: readonly MarkId[]) {
  return MARKS.flatMap((m) => {
    if (!m.line || !open.includes(m.id)) return [];
    const runs = segmentsOf(m.line);
    return cutsOf(m.line).map((cut, run) => {
      const r = runs[run];
      if (!r) throw new Error(`${m.id}: a cut with no run`);
      return { mark: m.id, run, cut, aside: asideOf(r), alongZ: runsAlongZ(r) };
    });
  });
}

function meshesOf(pieces: readonly Piece[], materials: Record<Cover, Material>, cast: boolean) {
  const byCover = new Map<Cover, BufferGeometry[]>();
  for (const p of pieces) {
    const list = byCover.get(p.cover) ?? [];
    list.push(slab(p, p.radius));
    byCover.set(p.cover, list);
  }
  return [...byCover].map(([cover, geometries]) => {
    const m = new Mesh(merge(geometries), materials[cover]);
    // Strata and paving cast into the cuts; the lawn's thin cover needn't.
    m.castShadow = cast && cover !== 'grass';
    m.receiveShadow = true;
    return m;
  });
}

/** The ground, cut along every line in `open`, each cut's lid in place to slide aside. */
export function buildGround(open: readonly MarkId[], materials: Record<Cover, Material>): Ground {
  const whole = wholeGround();
  const cuts = cutsFor(open);
  const holes = cuts.map((c) => c.cut);
  const pieces = whole.flatMap((p) =>
    carve(p, holes).map((b) => ({ ...b, cover: p.cover, radius: p.radius })),
  );
  const group = new Group();
  group.name = 'ground';
  group.add(...meshesOf(pieces, materials, true));
  const lids = cuts.map(({ mark, run, cut, aside, alongZ }): Lid => {
    const lidGroup = new Group();
    lidGroup.name = `lid ${mark} ${String(run)}`;
    const inside = whole.flatMap((p) => {
      const b = intersect(p, cut);
      return b ? [{ ...b, cover: p.cover, radius: p.radius }] : [];
    });
    // A lid moves, so it casts nothing: the shadow map holds still.
    lidGroup.add(...meshesOf(inside, materials, false));
    const width = alongZ ? cut.x1 - cut.x0 : cut.z1 - cut.z0;
    return { mark, run, group: lidGroup, aside, reach: width + 0.4, cut };
  });
  return {
    group,
    lids,
    dispose() {
      for (const g of [group, ...lids.map((l) => l.group)]) {
        g.traverse((o) => {
          if (o instanceof Mesh) (o.geometry as BufferGeometry).dispose();
        });
      }
    },
  };
}
