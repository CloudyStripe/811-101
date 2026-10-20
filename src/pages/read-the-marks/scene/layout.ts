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
import { MARK_LOOK } from './palette.ts';

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
  /** Where the gas line rises to its meter, just out from the wall. */
  gasRiser: { x: -6, z: -25.5 },
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
    line: {
      route: [{ x: F.gasRiser.x, z: STREET }, F.gasRiser],
      depth: 2.2,
      radius: 0.42,
      // Open to just short of the wall, so the riser shows rising from the line.
      inset: [0, -0.2],
    },
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
        { x: 9.2, z: -5 },
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

/** Where two boxes overlap in the ground's plane, if they do. */
export function overlapOf(a: Box, b: Box): Box | null {
  const x0 = Math.max(a.x0, b.x0);
  const x1 = Math.min(a.x1, b.x1);
  const z0 = Math.max(a.z0, b.z0);
  const z1 = Math.min(a.z1, b.z1);
  if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) return null;
  return { x0, x1, y0: Math.max(a.y0, b.y0), y1: Math.min(a.y1, b.y1), z0, z1 };
}

/** A box moved in the ground's plane. */
export const shifted = (b: Box, by: Point): Box => ({
  ...b,
  x0: b.x0 + by.x,
  x1: b.x1 + by.x,
  z0: b.z0 + by.z,
  z1: b.z1 + by.z,
});

/** A box less another, as up to four boxes around the part taken out. */
function less(box: Box, hole: Box): Box[] {
  const h = overlapOf(box, hole);
  if (!h) return [box];
  const out: Box[] = [];
  if (h.x0 > box.x0) out.push({ ...box, x1: h.x0 });
  if (h.x1 < box.x1) out.push({ ...box, x0: h.x1 });
  if (h.z0 > box.z0) out.push({ ...box, x0: h.x0, x1: h.x1, z1: h.z0 });
  if (h.z1 < box.z1) out.push({ ...box, x0: h.x0, x1: h.x1, z0: h.z1 });
  return out;
}

/** One run of one line, as the ground opens along it. */
export interface RunRef {
  mark: MarkId;
  run: number;
}

const sameRun = (a: RunRef | null, b: RunRef | null) =>
  a !== null && b !== null && a.mark === b.mark && a.run === b.run;

/** How far a run's cover slides to clear its cut: the cut's width across the run, and a little. */
export function reachOf(cut: Box, alongZ: boolean): number {
  return (alongZ ? cut.x1 - cut.x0 : cut.z1 - cut.z0) + 0.4;
}

/** The way a run's cover would slide by default: away from the camera, which looks from the street and the right. */
const awayOf = (run: readonly [Point, Point]): Point =>
  runsAlongZ(run) ? { x: -1, z: 0 } : { x: 0, z: -1 };

/** Every run of every line: its cut, the way it lies, and how far its cover slides. */
const RUNS = MARKS.flatMap((m) => {
  if (!m.line) return [];
  const cuts = cutsOf(m.line);
  return segmentsOf(m.line).flatMap((r, run) => {
    const cut = cuts[run];
    if (!cut) return [];
    const alongZ = runsAlongZ(r);
    return [{ ref: { mark: m.id, run }, cut, away: awayOf(r), reach: reachOf(cut, alongZ) }];
  });
});

const runInfo = (ref: RunRef) => {
  const info = RUNS.find((r) => sameRun(r.ref, ref));
  if (!info) throw new Error(`no run ${ref.mark} ${String(ref.run)}`);
  return info;
};

/** The ground a box passes over as it slides `reach` its way: from its leading edge on. */
export function sweptAhead(box: Box, dir: Point, reach: number): Box {
  if (dir.x < 0) return { ...box, x0: box.x0 - reach, x1: box.x0 };
  if (dir.x > 0) return { ...box, x0: box.x1, x1: box.x1 + reach };
  if (dir.z < 0) return { ...box, z0: box.z0 - reach, z1: box.z0 };
  return { ...box, z0: box.z1, z1: box.z1 + reach };
}

/** Whether a box, slid as a run's cover slides, passes over no cut but its own run's. */
const slidesClear = (ref: RunRef, box: Box, dir: Point) => {
  const swept = sweptAhead(box, dir, runInfo(ref).reach);
  return RUNS.every((r) => sameRun(r.ref, ref) || !overlapOf(swept, r.cut));
};

/**
 * Who covers where two runs of a line meet at its turn: the run whose cover, sliding its default
 * way, carries the overlap clear of the other's cut (so it never shows in that open trench); the
 * later run where neither or both would.
 */
function ownsTurn(a: RunRef, b: RunRef): RunRef {
  const overlap = overlapOf(runInfo(a).cut, runInfo(b).cut);
  if (!overlap) return b;
  const aClear = slidesClear(a, overlap, runInfo(a).away);
  const bClear = slidesClear(b, overlap, runInfo(b).away);
  return aClear && !bClear ? a : b;
}

/**
 * A run's cover, the ground that slides off its cut: the cut, less where it meets another run of
 * its line at a turn, if that run covers the turn.
 */
export function coverOf(ref: RunRef): Box[] {
  let boxes = [runInfo(ref).cut];
  for (const other of RUNS) {
    if (other.ref.mark !== ref.mark || other.ref.run === ref.run) continue;
    if (sameRun(ownsTurn(ref, other.ref), ref)) continue;
    boxes = boxes.flatMap((b) => less(b, other.cut));
  }
  return boxes;
}

/**
 * Which way a run's cover slides as the ground opens, and its flags step aside: away from the
 * camera, so nothing stands between it and the cut; or where that would carry it across another
 * cut, so it would show in that trench open, the other way.
 */
export function asideOf(ref: RunRef): Point {
  const { away } = runInfo(ref);
  const clear = (dir: Point) => coverOf(ref).every((b) => slidesClear(ref, b, dir));
  if (clear(away)) return away;
  const back = { x: -away.x, z: -away.z };
  return clear(back) ? back : away;
}

/** The run whose cover a flag's foot stands on, or a paint dash's footprint lies on, if any. */
export function coverAt(spot: MarkSpot): RunRef | null {
  const foot = footprintOf(spot);
  let best: { ref: RunRef; area: number } | null = null;
  for (const r of RUNS) {
    for (const b of coverOf(r.ref)) {
      const o = overlapOf(foot, b);
      const area = o ? (o.x1 - o.x0) * (o.z1 - o.z0) : 0;
      if (area > 0 && (!best || area > best.area)) best = { ref: r.ref, area };
    }
  }
  return best?.ref ?? null;
}

/** What a mark covers on the ground: a dash's footprint, or a flag stake's foot. */
export function footprintOf(spot: MarkSpot): Box {
  const along = spot.form === 'paint' ? MARK_LOOK.paint.length / 2 : 0.05;
  const across = spot.form === 'paint' ? MARK_LOOK.paint.width / 2 : 0.05;
  const alongX =
    spot.form !== 'paint' || Math.abs(Math.sin(((spot.heading ?? 0) * Math.PI) / 180)) < 0.5;
  const [hx, hz] = alongX ? [along, across] : [across, along];
  return { x0: spot.x - hx, x1: spot.x + hx, y0: 0, y1: 0, z0: spot.z - hz, z1: spot.z + hz };
}

/**
 * Where a flag in a run's cover steps to as the ground opens: across the cut, the way the cover
 * slides, onto the solid ground past its edge, `step` of the way.
 */
export function steppedAside(spot: Point, ref: RunRef, step: number): Point {
  const dir = asideOf(ref);
  const { cut } = runInfo(ref);
  // From the flag to the cut's far edge the way it steps, and a little past it.
  const toEdge =
    dir.x < 0
      ? spot.x - cut.x0
      : dir.x > 0
        ? cut.x1 - spot.x
        : dir.z < 0
          ? spot.z - cut.z0
          : cut.z1 - spot.z;
  const by = (toEdge + 0.5) * step;
  return { x: spot.x + dir.x * by, z: spot.z + dir.z * by };
}
