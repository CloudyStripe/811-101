/**
 * Where everything sits, in feet. Scene units are feet: x runs along the street from the hookup
 * (0) to the far end of the block, y is up from ground level, and z = 0 is the cut face, with the
 * street behind it (negative z).
 *
 * The block is a slab cut out of the ground, from the stake to the far end, and it's drawn deeper
 * than true: below ground every height is `depth` times its real value, and the lines are as many
 * times thicker, so the cut face reads as a broad band with the lines plain on it. The view says
 * it's not to scale. Above ground, everything is true size. Nothing here touches three.js, so the
 * layout can be checked in plain tests.
 */
import { GEOMETRY } from '../../../signal/constants.ts';
import type { SetupId } from '../../../signal/model.ts';
import type { View, VisibleArea } from '../../../kit3d/camera.ts';
import type { GroundRect } from '../../../kit3d/materials.ts';

type Point = readonly [number, number, number];

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

/** The ground's layers, top to bottom, at true depth in feet. */
const TRUE_STRATA = [
  { name: 'topsoil', top: 0, bottom: -1.2 },
  { name: 'subsoil', top: -1.2, bottom: -4.6 },
  { name: 'clay', top: -4.6, bottom: -7.4 },
  { name: 'gravel', top: -7.4, bottom: -8.6 },
  { name: 'rock', top: -8.6, bottom: -10 },
] as const;

export type StratumName = (typeof TRUE_STRATA)[number]['name'];

export interface Stratum {
  name: StratumName;
  top: number;
  bottom: number;
}

export interface LabLayoutOptions {
  /** How many times deeper than true the ground is drawn, and the lines thicker: 1 is to scale. */
  depth: number;
}

export interface LabLayout {
  depth: number;
  block: { x0: number; x1: number; z0: number; z1: number; bottom: number };
  strata: readonly Stratum[];
  /** The backfilled trench the gas main and telecom cable share, seen in section. */
  trench: { x0: number; zBack: number; bottom: number };
  /** The lines, each from its x0 to the end of the block, drawn thicker than real so they read. */
  lines: {
    steel: { y: number; radius: number; x0: number };
    plastic: { y: number; radius: number; x0: number };
    tracer: { y: number; radius: number; x0: number };
    telecom: { y: number; radius: number; x0: number };
    water: { x: number; y: number; radius: number; z0: number; z1: number };
  };
  hookup: {
    access: { x: number; z: number };
    transmitter: { x: number; z: number };
    stake: { x: number; z: number; tip: number; top: number };
    pedestal: { x: number; z: number };
  };
  hydrant: { x: number; z: number };
  /**
   * The transmitter's leads, lying in the grass, from the transmitter outward: the signal lead to
   * the access point and the ground lead to the stake. The signal glows along both, closing the loop.
   */
  leads: { signal: readonly Point[]; ground: readonly Point[] };
  /** The wire up the cut face from the line to its access point, from the line upward. */
  risers: Record<SetupId, readonly Point[]>;
  /** Where the earth-return flow lines converge: the stake's tip, on the cut face. */
  stakeTip: Point;
  /** Trees on the far lawn and street lights on the far sidewalk: small, so the cut face leads. */
  trees: readonly { x: number; z: number; height: number }[];
  lamps: readonly { x: number; z: number }[];
  shrubs: readonly { x: number; z: number; size: number }[];
  /** Flat stones across the far lawn, from the sidewalk toward the yard. */
  steppingStones: readonly GroundRect[];
  /** Where the grass wears thin: along the kerbs and the sidewalk, and around what stands on it. */
  worn: readonly GroundRect[];
  /** What every view must show: the whole slab, the trees above it, and room for the hookup's labels. */
  mustSee: readonly Point[];
}

/** The far lawn, between the sidewalk and the back of the block. */
const LAWN_Z = -37;

/** The block's layout, drawn `depth` times deeper than true below ground. */
export function labLayout({ depth }: LabLayoutOptions): LabLayout {
  const d = (y: number) => y * depth;
  const x1 = GEOMETRY.blockLengthFt.value + 6;
  const block = { x0: -34, x1, z0: -40, z1: 0, bottom: d(-10) };
  const strata = TRUE_STRATA.map((s) => ({ name: s.name, top: d(s.top), bottom: d(s.bottom) }));
  const steel = { y: d(-3.6), radius: 0.42 * depth, x0: -0.8 };
  const plastic = { y: d(-3.6), radius: 0.33 * depth, x0: -0.8 };
  const lines = {
    steel,
    plastic,
    tracer: { y: plastic.y + plastic.radius + 0.07 * depth, radius: 0.06 * depth, x0: -0.6 },
    // Ends where it turns back to its pedestal, so the ground stake stands clear of every line.
    telecom: { y: d(-2.3), radius: 0.18 * depth, x0: -13 },
    water: {
      x: GEOMETRY.waterCrossingAtFt.value,
      y: d(-6.6),
      radius: 0.48 * depth,
      z0: block.z0,
      z1: 0.35 * depth,
    },
  };
  // Wide enough to hold the gas main, however thick it's drawn.
  const trench = { x0: -1.6, zBack: -Math.max(2.4, steel.radius * 3), bottom: d(-4.6) };
  const hookup = {
    access: { x: 0, z: -1.5 },
    transmitter: { x: -6.5, z: -3.3 },
    stake: { x: -24, z: 0, tip: d(-2.6), top: 1.1 },
    pedestal: { x: -14, z: -4.3 },
  };
  const hydrant = { x: GEOMETRY.waterCrossingAtFt.value + 4, z: -4.6 };
  const tx = hookup.transmitter;
  const access = hookup.access;
  const stake = hookup.stake;
  const leads = {
    signal: [
      [tx.x + 0.3, 0.35, tx.z + 0.5],
      [tx.x + 1.6, 0.16, tx.z + 1.4],
      [access.x - 1.4, 0.16, access.z - 0.4],
      [access.x - 0.3, 0.3, access.z],
    ],
    ground: [
      [tx.x - 0.4, 0.35, tx.z + 0.5],
      [tx.x - 3, 0.16, tx.z + 1.6],
      [stake.x + 6, 0.16, -1.4],
      [stake.x + 0.6, 0.18, -0.5],
      [stake.x + 0.08, stake.top - 0.3, 0],
    ],
  } satisfies LabLayout['leads'];
  const risers: Record<SetupId, readonly Point[]> = {
    steel: [
      [0.4, steel.y + steel.radius, 0.2],
      [0.4, d(-1.6), 0.22],
      [0.38, d(-0.2), 0.2],
      [0.25, 0.14, -0.45],
      [access.x + 0.05, 0.3, access.z + 0.05],
    ],
    plastic: [
      [lines.tracer.x0 + 0.1, lines.tracer.y, 0.06],
      [-0.5, d(-1.8), 0.12],
      [-0.4, d(-0.25), 0.12],
      [-0.25, 0.1, -0.5],
      [access.x, 0.12, access.z + 0.05],
    ],
  };
  const trees = (
    [
      [20, 13],
      [64, 14],
      [108, 12.5],
      [134, 13.5],
    ] as const
  ).map(([x, height]) => ({ x, z: LAWN_Z, height }));
  const lamps = [36, 118].map((x) => ({ x, z: (SURFACE.farCurbBack + SURFACE.sidewalkBack) / 2 }));
  // Shrubs sit whole on the far lawn, between the sidewalk and the slab's back edge.
  const shrubs = [-26, -19, 6, 33, 44, 52, 79, 95, 101, 121, 142].map((x, i) => ({
    x,
    z: LAWN_Z + ((i % 3) - 1) * 0.5,
    size: 2.6 + (i % 4) * 0.4,
  }));
  const steppingStones = [0, 1, 2, 3].map((i) => {
    const x = 86 + (i % 2) * 0.6;
    const z = SURFACE.sidewalkBack - 0.9 - i * 1.5;
    return { x0: x - 0.6, x1: x + 0.6, z0: z - 0.45, z1: z + 0.45 };
  });
  const around = (x: number, z: number, r: number) => ({
    x0: x - r,
    x1: x + r,
    z0: z - r,
    z1: z + r,
  });
  const worn: GroundRect[] = [
    { x0: block.x0, x1: block.x1, z0: SURFACE.curbBack, z1: SURFACE.curbFront },
    { x0: block.x0, x1: block.x1, z0: SURFACE.sidewalkBack, z1: SURFACE.farCurbBack },
    { x0: DRIVEWAY.x0, x1: DRIVEWAY.x1, z0: SURFACE.vergeBack, z1: 0 },
    around(tx.x, tx.z, 1),
    around(access.x, access.z, 0.4),
    around(stake.x, stake.z, 0.3),
    around(hookup.pedestal.x, hookup.pedestal.z, 0.6),
    around(hydrant.x, hydrant.z, 0.5),
    ...steppingStones,
  ];
  // The whole slab, the trees on it, and room above the hookup for its labels.
  const mustSee: Point[] = [
    [block.x0, block.bottom, 0],
    [block.x1, block.bottom, 0],
    [block.x0, 0.5, block.z0],
    [block.x1, 0.5, block.z0],
    ...trees.map((t): Point => [t.x, t.height + 0.5, t.z]),
    [stake.x - 2, stake.top + 3, stake.z],
    [tx.x, 4, tx.z],
    [access.x, 6, access.z],
  ];
  return {
    depth,
    block,
    strata,
    trench,
    lines,
    hookup,
    hydrant,
    leads,
    risers,
    stakeTip: [stake.x, stake.tip, 0.12],
    trees,
    lamps,
    shrubs,
    steppingStones,
    worn,
    mustSee,
  };
}

/** Half a label's width, so labels on points near the sides of the view still fit. */
const LABEL_ROOM = 48;

/**
 * A view of the slab from `azimuth` degrees round from square to its cut face (negative: from the
 * hookup end), `elevation` degrees up, aimed at the slab's middle.
 */
function slabView(
  layout: LabLayout,
  azimuth: number,
  elevation: number,
  extra: Partial<View>,
): View {
  const { block } = layout;
  const target: Point = [(block.x0 + block.x1) / 2, block.bottom / 2, -10];
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  return {
    position: [
      target[0] + Math.sin(az) * Math.cos(el) * 100,
      target[1] + Math.sin(el) * 100,
      target[2] + Math.cos(az) * Math.cos(el) * 100,
    ],
    target,
    mustSee: layout.mustSee,
    labelRoom: LABEL_ROOM,
    ...extra,
  };
}

/**
 * Wide screens: almost square to the cut face and a little above it, the lines running left to
 * right, turned a touch toward the hookup so the equipment stands clear of the face.
 */
export function wideView(layout: LabLayout): View {
  return slabView(layout, -8, 15, { margin: 0.04, fov: 28 });
}

/**
 * Tall screens: from the hookup end, at three-quarters, so the run recedes up the screen with the
 * hookup large at the bottom.
 */
export function tallView(layout: LabLayout): View {
  return slabView(layout, -58, 24, { margin: 0.03, labelRoom: 18, fov: 50 });
}

/** A screen or free area this much taller than wide gets the tall view. */
const TALL = 1.05;

/**
 * The view that suits the screen: the tall view on a screen held upright, whatever strip of it the
 * controls leave free, or in a free area taller than wide, as beside the controls on a phone held
 * sideways; the wide view otherwise. A free area can also ask for one or the other.
 */
export function viewFor(
  layout: LabLayout,
  area: VisibleArea,
  canvas: { width: number; height: number },
): View {
  const tall =
    area.portrait ?? (canvas.height > canvas.width * TALL || area.height > area.width * TALL);
  return tall ? tallView(layout) : wideView(layout);
}
