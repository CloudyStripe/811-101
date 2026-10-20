/**
 * The yard, in feet: x runs along the street (left to right as seen from it), z from the back of
 * the lot toward the street, y up, the ground's surface at y = 0. A 64 ft lot: the house and its
 * garage at the back, the front lawn, the sidewalk, a grass strip and the curb, then the street.
 *
 * Every mark is in the yard, none in the street: a line that comes from the street is marked from
 * the curb in. Flags stand on the grass, and paint goes where a line crosses the sidewalk or the
 * driveway. Each line is one a locator would mark for a dig in the front lawn; where a line becomes
 * the owner's (past a meter box, or the sewer cleanout), it isn't drawn, as those usually aren't
 * marked through 811.
 *
 * Every line runs along x or z, straight or with one turn, so the ground opens along it as a box.
 */
import type { ApwaCode } from '../../../design/apwa.ts';
import { MARK_COLOR, type MarkId } from '../game.ts';

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface Point {
  x: number;
  z: number;
}

export const BLOCK = { x0: -32, x1: 32, z0: -46, z1: 22, bottom: -11 } as const;

/** Where each band across the lot ends (z), back to front. */
export const BANDS = {
  /** The house's front wall. */
  house: -26,
  sidewalkBack: 0,
  sidewalkFront: 5,
  /** The grass strip between the sidewalk and the curb. */
  stripFront: 11,
  curbFront: 11.6,
  gutterFront: 12.6,
} as const;

/** How high each surface's top is. */
export const TOPS = {
  grass: 0.12,
  sidewalk: 0.3,
  driveway: 0.28,
  apron: 0.24,
  curb: 0.5,
  gutter: 0.06,
  street: 0.02,
} as const;

export const HOUSE = { x0: -22, x1: 10, z0: -43, z1: -26, wall: 9.5, ridge: 15 } as const;
export const GARAGE = { x0: 10, x1: 22, z0: -42, z1: -23, wall: 9, ridge: 13.5 } as const;
/** The driveway runs from the garage across the sidewalk and the grass strip to the curb. */
export const DRIVEWAY = { x0: 11, x1: 21 } as const;

/** Where you plan to dig: a bed in the front lawn. */
export const DIG = { x0: -12, x1: 0, z0: -11, z1: -3 } as const;

/** What stands at the lines' ends. */
export const FIXTURES = {
  transformer: { x: 26.5, z: -5 },
  pedestal: { x: -17, z: -1.8 },
  waterBox: { x: 4, z: 7.6 },
  reclaimedBox: { x: 26, z: 7.6 },
  cleanout: { x: -22, z: 6.3 },
  gasMeter: { x: -6, z: -26 },
  electricMeter: { x: 6, z: -26 },
  /** Where the communication cable meets the house. */
  terminal: { x: -17, z: -26 },
} as const;

/** A buried line: its route (a turn at most), how deep it lies, how thick it's drawn. */
export interface Line {
  route: readonly Point[];
  depth: number;
  radius: number;
  /**
   * How far short of each end of its route the ground opens: past a box standing there, so the
   * box keeps its footing; negative to open past the end, as past the cleanout, so its riser
   * shows. The street end opens only to the curb, wherever the route starts.
   */
  inset?: readonly [number, number];
}

export type MarkForm = 'flag' | 'paint';

export interface MarkSpot extends Point {
  form: MarkForm;
  /** Which way a paint dash runs, in degrees from +x toward +z. */
  heading?: number;
}

export interface Mark {
  id: MarkId;
  color: ApwaCode;
  /** The buried line its marks show; none for white and pink, which don't mark buried lines. */
  line: Line | null;
  spots: readonly MarkSpot[];
}

/** Where a line that comes from the street starts: under the street, out past the curb. */
const STREET = 14;

const flags = (points: readonly Point[]): MarkSpot[] => points.map((p) => ({ ...p, form: 'flag' }));
const paint = (points: readonly Point[], heading: number): MarkSpot[] =>
  points.map((p) => ({ ...p, form: 'paint', heading }));
const alongZ = (x: number, zs: readonly number[]) => zs.map((z) => ({ x, z }));
const alongX = (z: number, xs: readonly number[]) => xs.map((x) => ({ x, z }));

/** The dig's outline: dashes along each side, and a flag at each corner. */
function outline(): MarkSpot[] {
  const { x0, x1, z0, z1 } = DIG;
  const spots: MarkSpot[] = [];
  for (let x = x0 + 1.2; x < x1 - 0.6; x += 2) {
    spots.push(
      ...paint(
        [
          { x, z: z0 },
          { x, z: z1 },
        ],
        0,
      ),
    );
  }
  for (let z = z0 + 1.3; z < z1 - 0.6; z += 2) {
    spots.push(
      ...paint(
        [
          { x: x0, z },
          { x: x1, z },
        ],
        90,
      ),
    );
  }
  spots.push(
    ...flags([
      { x: x0, z: z0 },
      { x: x1, z: z0 },
      { x: x0, z: z1 },
      { x: x1, z: z1 },
    ]),
  );
  return spots;
}

const F = FIXTURES;

export const MARKS: readonly Mark[] = [
  { id: 'dig', color: MARK_COLOR.dig, line: null, spots: outline() },
  {
    id: 'gas',
    color: MARK_COLOR.gas,
    line: { route: [{ x: F.gasMeter.x, z: STREET }, F.gasMeter], depth: 2.2, radius: 0.42 },
    spots: [
      ...flags(alongZ(-6, [8.4])),
      ...paint(alongZ(-6, [1.4, 3.6]), 90),
      ...flags(alongZ(-6, [-1.5, -7, -12.5, -18, -23.5])),
    ],
  },
  {
    id: 'electric',
    color: MARK_COLOR.electric,
    line: {
      route: [F.transformer, { x: F.electricMeter.x, z: F.transformer.z }, F.electricMeter],
      depth: 2.4,
      radius: 0.36,
      inset: [1.75, 0],
    },
    spots: [
      ...flags(alongX(-5, [24.2])),
      ...paint(alongX(-5, [13.3, 16, 18.7]), 0),
      ...flags([
        { x: 8.6, z: -5 },
        { x: 6, z: -5.6 },
      ]),
      ...flags(alongZ(6, [-11, -16.5, -22])),
    ],
  },
  {
    id: 'communication',
    color: MARK_COLOR.communication,
    line: { route: [F.pedestal, F.terminal], depth: 1.5, radius: 0.26, inset: [0.6, 0] },
    spots: flags(alongZ(-17, [-4.2, -9.6, -15, -20.4, -24.8])),
  },
  {
    id: 'water',
    color: MARK_COLOR.water,
    line: {
      route: [{ x: F.waterBox.x, z: STREET }, F.waterBox],
      depth: 3.6,
      radius: 0.32,
      inset: [0, 0.65],
    },
    spots: flags(alongZ(F.waterBox.x, [10.3, 8.8])),
  },
  {
    id: 'sewer',
    color: MARK_COLOR.sewer,
    line: {
      route: [{ x: F.cleanout.x, z: STREET }, F.cleanout],
      depth: 5,
      radius: 0.42,
      inset: [0, -0.8],
    },
    spots: flags(alongZ(F.cleanout.x, [10.3, 8.4])),
  },
  {
    id: 'reclaimed',
    color: MARK_COLOR.reclaimed,
    line: {
      route: [{ x: F.reclaimedBox.x, z: STREET }, F.reclaimedBox],
      depth: 3.6,
      radius: 0.32,
      inset: [0, 0.65],
    },
    spots: flags(alongZ(F.reclaimedBox.x, [10.3, 8.8])),
  },
  {
    id: 'survey',
    color: MARK_COLOR.survey,
    line: null,
    spots: flags(alongZ(-30.5, [-1.5, -7, -12.5, -18, -23.5])),
  },
];

export function markById(id: MarkId): Mark {
  const mark = MARKS.find((m) => m.id === id);
  if (!mark) throw new Error(`no mark ${id}`);
  return mark;
}

/** What the ground is at a point: grass, the sidewalk, the driveway, the curb or the street. */
export type Ground = 'grass' | 'sidewalk' | 'driveway' | 'curb' | 'street';

export function groundAt({ x, z }: Point): Ground {
  if (z >= BANDS.curbFront) return 'street';
  if (z >= BANDS.stripFront) return 'curb';
  const onDriveway = x > DRIVEWAY.x0 && x < DRIVEWAY.x1 && z > GARAGE.z1;
  if (onDriveway) return 'driveway';
  if (z >= BANDS.sidewalkBack && z < BANDS.sidewalkFront) return 'sidewalk';
  return 'grass';
}

/** How high the ground's top is at a point. */
export function topAt(p: Point): number {
  const g = groundAt(p);
  if (g === 'driveway') return p.z > BANDS.sidewalkFront ? TOPS.apron : TOPS.driveway;
  if (g === 'sidewalk') return TOPS.sidewalk;
  if (g === 'curb') return TOPS.curb;
  if (g === 'street') return p.z < BANDS.gutterFront ? TOPS.gutter : TOPS.street;
  return TOPS.grass;
}

/** A line's straight runs, each from one point of its route to the next. */
export function segmentsOf(line: Line): [Point, Point][] {
  const out: [Point, Point][] = [];
  for (let i = 1; i < line.route.length; i++) {
    const a = line.route[i - 1];
    const b = line.route[i];
    if (a && b) out.push([a, b]);
  }
  return out;
}

/** How far the ground opens to each side of a line, past its own half width. */
export const CUT_HALF = 2.2;
/** How far below a line the cut goes. */
export const CUT_BELOW = 0.35;

/** How near the house's front wall a cut comes. */
const WALL_GAP = 0.3;

/** Whether a straight run goes along z (else along x). */
export const runsAlongZ = ([a, b]: readonly [Point, Point]): boolean => Math.abs(a.x - b.x) < 1e-6;

/**
 * Where the ground opens along a line: a box per straight run, from the curb in, as wide as it
 * takes to see the line in it, down to just below it. At a turn the runs reach past it, so they
 * meet without a gap; at the house they stop just short of its wall.
 */
export function cutsOf(line: Line): Box[] {
  const half = CUT_HALF + line.radius;
  const y0 = -(line.depth + line.radius + CUT_BELOW);
  const runs = segmentsOf(line);
  const [startInset, endInset] = line.inset ?? [0, 0];
  return runs.map((run, i) => {
    const [a, b] = run;
    const z = runsAlongZ(run);
    const from = z ? a.z : a.x;
    const to = z ? b.z : b.x;
    const dir = Math.sign(to - from);
    const s = i === 0 ? from + dir * startInset : from - dir * half;
    const e = i === runs.length - 1 ? to - dir * endInset : to + dir * half;
    let lo = Math.min(s, e);
    let hi = Math.max(s, e);
    if (z) {
      hi = Math.min(hi, BANDS.stripFront);
      lo = Math.max(lo, BANDS.house + WALL_GAP);
      return { x0: a.x - half, x1: a.x + half, y0, y1: 2, z0: lo, z1: hi };
    }
    return { x0: lo, x1: hi, y0, y1: 2, z0: a.z - half, z1: a.z + half };
  });
}

/**
 * Which way the ground slides away as it opens, and the flags over the line step aside: away from
 * the camera, which looks from the street and the right, so nothing stands between it and the cut.
 */
export function asideOf(run: readonly [Point, Point]): Point {
  return runsAlongZ(run) ? { x: -1, z: 0 } : { x: 0, z: -1 };
}
