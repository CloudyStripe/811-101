/**
 * Where everything sits, in feet. Scene units are feet: x runs along the street from the hookup
 * (0) to the far end of the block, y is up from ground level, and z = 0 is the cut face, with the
 * street behind it (negative z).
 */
import { GEOMETRY } from '../../../signal/constants.ts';
import type { SetupId } from '../../../signal/model.ts';
import type { View } from '../../../kit3d/camera.ts';

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

/** Where the earth-return flow lines converge: the stake's tip, on the cut face. */
export const STAKE_TIP: readonly [number, number, number] = [
  HOOKUP.stake.x,
  HOOKUP.stake.tip,
  0.12,
];

/**
 * Looking down the street from the hookup end, so the near field is large and reach recedes. Both
 * setups share one view, so switching swaps only what is underground and the two compare directly.
 */
const VIEW: View = { position: [-49, 12.5, 29], target: [19, -3, -4] };
export const VIEWS: Record<SetupId, View> = { steel: VIEW, plastic: VIEW };
