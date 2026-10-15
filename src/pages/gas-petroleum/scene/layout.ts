/**
 * Where everything sits in the diorama, in model units (no real scale). The block is cut out of
 * the ground and stands on a floor: x runs along it from the shared start (west) to the town
 * (east), y is up from the grass, and its front face, where the rock layers show, is at z = Z1.
 */

/** The block's extent and its front face, just proud of the cut so things drawn on it show. */
export const BLOCK = { x0: -42, x1: 42, z0: -24, z1: 24, bottom: -16 } as const;
export const FACE = BLOCK.z1 + 0.04;
/** The back face, where the gas storage underground shows. */
export const BACK = BLOCK.z0 - 0.04;

/** The rock rises in a gentle dome to the west, where the oil and gas collect. */
export function dome(x: number): number {
  return 2.4 * Math.exp(-((x + 28) ** 2) / 98);
}

/**
 * The boundaries between layers, top to bottom, as functions of x: the grass's underside, the
 * soil's, the groundwater sand's, the cap rock's top and bottom (the reservoir's top), the
 * reservoir's bottom, the source rock's top and bottom, and the block's base.
 */
export const BOUNDARIES: readonly ((x: number) => number)[] = [
  () => -0.15,
  () => -0.9,
  () => -3.2,
  (x) => -6.4 + dome(x),
  (x) => -7.6 + dome(x),
  (x) => -10.4 + dome(x),
  (x) => -12.2 + 0.45 * dome(x),
  (x) => -14.4 + 0.2 * dome(x),
  () => BLOCK.bottom,
];

/** Where gas gives way to oil, and oil to salty water, in the reservoir rock. */
export const GAS_OIL = -5.9;
export const OIL_WATER = -6.9;

/** The boundary below layer i's top, at x. */
export function boundary(i: number, x: number): number {
  const f = BOUNDARIES[i];
  if (!f) throw new Error(`No boundary ${String(i)}`);
  return f(x);
}

/** Anchor points the stops and the routes share: move a site here and both follow. */
export const SITE = {
  /** The pump jack's well, which ends in the oil. */
  oilWell: { x: -36, z: 23.3 },
  /** The gas wellhead on the crest of the dome. */
  gasWell: { x: -28, z: 23.2 },
  /** The separator, lying along x. */
  separator: { x: -28, y: 1.35, z: 13.5, len: 5 },
  waterTank: { x: -33.4, z: 11.4 },
  /** The refinery's distillation tower. */
  tower: { x: -1, z: 14 },
  /** The gas storage well, by the back of the block. */
  storage: { x: 6, z: -21.6 },
  /** The buried gas main runs along this line. */
  gasMain: { z: -9 },
  cityGate: { x: 17, z: -9 },
  /** The town street the gas main runs along. */
  street: { z: -1.2 },
} as const;

/** The harbor behind the block: a strip of sea where the LNG ship docks. */
export const HARBOR = { x0: 12, x1: 42, z0: -40, z1: -24, water: -0.7 } as const;

/** Every corner of the model, the harbor included: what the overview frames. */
export const MODEL_BOX = {
  min: [BLOCK.x0, BLOCK.bottom, HARBOR.z0],
  max: [BLOCK.x1, 9, BLOCK.z1],
} as const;
