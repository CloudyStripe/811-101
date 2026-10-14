/**
 * Where everything sits, in feet. Scene units are feet: x runs along the street from the hookup
 * (0) to the far end of the block, y is up from ground level, and z = 0 is the cut face, with the
 * street behind it (negative z).
 */
import { GEOMETRY } from '../../../signal/constants.ts';
import type { SetupId } from '../../../signal/model.ts';
import type { View, VisibleArea } from '../../../kit3d/camera.ts';

const BLOCK_END = GEOMETRY.blockLengthFt.value + 6;

export const BLOCK = { x0: -34, x1: BLOCK_END, z0: -40, z1: 0, bottom: -10 } as const;

/**
 * The section doesn't stop at the block: the street, its layers and its lines run on both ways,
 * so the block reads as part of a town, not a slab floating in space. They run on well past where
 * the fog closes in, so no view sees where they end.
 */
export const WORLD = { x0: -170, x1: 1500 } as const;

/**
 * Pipes and cables are drawn on past the block, into the fog, and the signal with them as far as
 * the model follows it.
 */
export const PIPE_END = WORLD.x1;

/**
 * Small details (pipe couplings, sidewalk joints) stop here, and homes, trees and street lights a
 * little farther on: past these, the fog has all but closed in, and only the long forms run on.
 */
export const DETAIL_END = 600;
export const SCENERY_END = 960;

/** The ground behind the block, out past where the fog closes in. */
export const GROUND = { x0: -2000, x1: 2500, z0: -2000 } as const;

/**
 * A cross street at each end of the block, so "the end of the block" is a place you can see: the
 * street and its lines run on through the intersection.
 */
export const CROSS_STREETS = [
  { x0: BLOCK.x0 - 32, x1: BLOCK.x0 },
  { x0: BLOCK.x1, x1: BLOCK.x1 + 32 },
] as const;

/** Across a cross street, from either edge: a sidewalk, a curb, then the roadway between. */
export const CROSS_SECTION = { sidewalk: 5, curb: 0.5 } as const;

/** A cross street's roadway, between its curbs: the part the main street's gutters stop at. */
export function roadwayOf(street: { x0: number; x1: number }): { x0: number; x1: number } {
  const edge = CROSS_SECTION.sidewalk + CROSS_SECTION.curb;
  return { x0: street.x0 + edge, x1: street.x1 - edge };
}
export const CROSS_ROADWAYS = CROSS_STREETS.map(roadwayOf);

/** Whether x falls within a cross street, or within `pad` of one. */
export function inCrossStreet(x: number, pad = 0): boolean {
  return CROSS_STREETS.some((c) => x > c.x0 - pad && x < c.x1 + pad);
}

/** The parts of [x0, x1] not cut by the given spans: where a strip of pavement or lawn runs. */
export function spansBetween(
  x0: number,
  x1: number,
  cuts: readonly { x0: number; x1: number }[],
): { x0: number; x1: number }[] {
  const out: { x0: number; x1: number }[] = [];
  let start = x0;
  for (const cut of [...cuts].sort((a, b) => a.x0 - b.x0)) {
    if (cut.x1 <= start || cut.x0 >= x1) continue;
    if (cut.x0 > start) out.push({ x0: start, x1: cut.x0 });
    start = Math.max(start, cut.x1);
  }
  if (start < x1) out.push({ x0: start, x1 });
  return out;
}

/** Front to back: grass verge over the lines, curb and gutter, street, far curb, sidewalk, lawn. */
export const SURFACE = {
  vergeBack: -6,
  curbFront: -6,
  curbBack: -6.5,
  gutterBack: -7.6,
  streetBack: -27.5,
  farGutterBack: -28.6,
  farCurbBack: -29.1,
  sidewalkBack: -34,
} as const;

/** A driveway crosses the verge, with a newer patched panel in its apron. */
export const DRIVEWAY = { x0: 62, x1: 78 } as const;
export const PATCH = { x0: 66.5, x1: 73.5 } as const;

export const STRATA = [
  { name: 'topsoil', top: 0, bottom: -1.2 },
  { name: 'subsoil', top: -1.2, bottom: -4.6 },
  { name: 'clay', top: -4.6, bottom: -7.4 },
  { name: 'gravel', top: -7.4, bottom: -8.6 },
  { name: 'rock', top: -8.6, bottom: BLOCK.bottom },
] as const;

export type StratumName = (typeof STRATA)[number]['name'];

/** The backfilled trench the gas main and telecom cable share, seen in section. */
export const TRENCH = { x0: -1.6, zBack: -2.4, bottom: -4.6 } as const;

/**
 * Lines are drawn somewhat thicker than real so they read at diorama scale. Each starts at its x0
 * and runs on to PIPE_END.
 */
export const LINES = {
  steel: { y: -3.6, radius: 0.42, x0: -0.8 },
  plastic: { y: -3.6, radius: 0.33, x0: -0.8 },
  tracer: { y: -3.6 + 0.33 + 0.07, radius: 0.06, x0: -0.6 },
  // Ends where it turns back to its pedestal, so the ground stake stands clear of every line.
  telecom: { y: -2.3, radius: 0.18, x0: -13 },
  water: { x: GEOMETRY.waterCrossingAtFt.value, y: -6.6, radius: 0.48, z0: BLOCK.z0, z1: 0.35 },
} as const;

export const HOOKUP = {
  access: { x: 0, z: -1.5 },
  transmitter: { x: -6.5, z: -3.3 },
  stake: { x: -24, z: 0, tip: -2.6, top: 1.1 },
  pedestal: { x: -14, z: -4.3 },
} as const;

export const HYDRANT = { x: GEOMETRY.waterCrossingAtFt.value + 4, z: -4.6 } as const;

type Point = readonly [number, number, number];
const TX = HOOKUP.transmitter;
const ACCESS = HOOKUP.access;
const STAKE = HOOKUP.stake;

/**
 * The transmitter's leads, lying in the grass, from the transmitter outward: the signal lead to
 * the access point and the ground lead to the stake. The signal glows along both, closing the loop.
 */
export const LEADS: { signal: readonly Point[]; ground: readonly Point[] } = {
  signal: [
    [TX.x + 0.3, 0.35, TX.z + 0.5],
    [TX.x + 1.6, 0.16, TX.z + 1.4],
    [ACCESS.x - 1.4, 0.16, ACCESS.z - 0.4],
    [ACCESS.x - 0.3, 0.3, ACCESS.z],
  ],
  ground: [
    [TX.x - 0.4, 0.35, TX.z + 0.5],
    [TX.x - 3, 0.16, TX.z + 1.6],
    [STAKE.x + 6, 0.16, -1.4],
    [STAKE.x + 0.6, 0.18, -0.5],
    [STAKE.x + 0.08, STAKE.top - 0.3, 0],
  ],
};

/** The wire up the cut face from the line to its access point, from the line upward. */
export const RISERS: Record<SetupId, readonly Point[]> = {
  steel: [
    [0.4, LINES.steel.y + LINES.steel.radius, 0.2],
    [0.4, -1.6, 0.22],
    [0.38, -0.2, 0.2],
    [0.25, 0.14, -0.45],
    [ACCESS.x + 0.05, 0.3, ACCESS.z + 0.05],
  ],
  plastic: [
    [LINES.tracer.x0 + 0.1, LINES.tracer.y, 0.06],
    [-0.5, -1.8, 0.12],
    [-0.4, -0.25, 0.12],
    [-0.25, 0.1, -0.5],
    [ACCESS.x, 0.12, ACCESS.z + 0.05],
  ],
};

/** Where the earth-return flow lines converge: the stake's tip, on the cut face. */
export const STAKE_TIP: readonly [number, number, number] = [
  HOOKUP.stake.x,
  HOOKUP.stake.tip,
  0.12,
];

/**
 * What every view must show: the hookup, with room above for its labels, the cut down to its
 * foot, and the far end of the line, where reach is judged. The camera is fitted to these.
 */
export const MUST_SEE: readonly Point[] = [
  [HOOKUP.stake.x - 2, HOOKUP.stake.top + 3, HOOKUP.stake.z],
  [HOOKUP.transmitter.x, 4, HOOKUP.transmitter.z],
  [HOOKUP.access.x, 6, HOOKUP.access.z],
  // The stake's tip, where the earth return comes home.
  [HOOKUP.stake.x, -4, 0],
  [BLOCK.x1 - 6, LINES.steel.y, 0],
  // The earth return's deepest paths run far along the block.
  [BLOCK.x1 - 16, -8.6, 0],
];

/** Where the section and the street end, far down it: the fog hides it from every view. */
export const WORLD_EDGE: Point = [WORLD.x1, 0, BLOCK.z0 / 2];

/** The end of the block, where wide views show the cross street, across the cut from the line. */
const CROSS_STREET_BEYOND: Point = [CROSS_STREETS[1].x1 - 4, 0.5, 0];

/** Half a label's width, so labels on points near the sides of the view still fit. */
const LABEL_ROOM = 48;

/**
 * Looking down the street from the hookup end, so the near field is large and reach recedes. Both
 * setups share each view, so switching swaps only what is underground and the two compare directly.
 */
export const WIDE_VIEW: View = {
  position: [-49, 12.5, 29],
  target: [19, -3, -4],
  mustSee: [...MUST_SEE, CROSS_STREET_BEYOND],
  // Wide screens have room to spare: keep some street and town around the lesson, and don't
  // come in so close that the hookup swells and the far end shrinks away.
  margin: 0.16,
  minDistance: 100,
  labelRoom: LABEL_ROOM,
};

/**
 * For portrait screens: higher, so the block runs up the screen from the hookup toward the end
 * of the block, with room beside the hookup for its labels. (A phone held upright sees only about
 * 16° across, so the cross street beyond is left to run off the top.)
 */
export const TALL_VIEW: View = {
  position: [-95.7, 41.4, 40.1],
  target: [40, -5, -4],
  mustSee: MUST_SEE,
  labelRoom: LABEL_ROOM,
};

/** The view that suits the free part of the canvas. */
export function viewFor(area: VisibleArea): View {
  const portrait = area.portrait ?? area.width / Math.max(1, area.height) < 1;
  return portrait ? TALL_VIEW : WIDE_VIEW;
}
