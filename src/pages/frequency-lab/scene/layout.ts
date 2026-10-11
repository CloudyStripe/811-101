/**
 * Where everything sits, in feet. Scene units are feet: x runs along the street from the hookup
 * (0) to the far end of the block, y is up from ground level, and z = 0 is the cut face, with the
 * street behind it (negative z).
 */
import { GEOMETRY } from '../../../signal/constants.ts';
import type { SetupId } from '../../../signal/model.ts';
import type { View, VisibleArea } from '../../../kit3d/camera.ts';

const BLOCK_END = GEOMETRY.blockLengthFt.value + 6;

export const BLOCK = { x0: -34, x1: BLOCK_END, z0: -40, z1: 0, bottom: -9 } as const;

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
  { name: 'deep', top: -7.4, bottom: BLOCK.bottom },
] as const;

/** The backfilled trench the gas main and telecom cable share, seen in section. */
export const TRENCH = { x0: -1.6, x1: BLOCK_END, zBack: -2.4, bottom: -4.6 } as const;

/** Lines are drawn somewhat thicker than real so they read at diorama scale. */
export const LINES = {
  steel: { y: -3.6, radius: 0.42, x0: -0.8, x1: BLOCK_END },
  plastic: { y: -3.6, radius: 0.33, x0: -0.8, x1: BLOCK_END },
  tracer: { y: -3.6 + 0.33 + 0.07, radius: 0.06, x0: -0.6, x1: BLOCK_END },
  // Ends where it turns back to its pedestal, so the ground stake stands clear of every line.
  telecom: { y: -2.3, radius: 0.18, x0: -13, x1: BLOCK_END },
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
 * Looking down the street from the hookup end, so the near field is large and reach recedes. Both
 * setups share each view, so switching swaps only what is underground and the two compare directly.
 */
export const WIDE_VIEW: View = { position: [-49, 12.5, 29], target: [19, -3, -4], aspect: 1.6 };

/**
 * For portrait screens: higher and further back, so the whole block runs diagonally up the screen
 * and the cut face still reads. (A phone held upright sees only about 16° across.)
 */
export const TALL_VIEW: View = { position: [-72, 40, 24], target: [36, -4, -8], aspect: 0.8 };

/** The view that suits the free part of the canvas. */
export function viewFor(area: VisibleArea): View {
  const portrait = area.portrait ?? area.width / Math.max(1, area.height) < 1;
  return portrait ? TALL_VIEW : WIDE_VIEW;
}
