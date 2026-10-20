/**
 * How the yard looks: its neutrals, and how its marks are drawn. The marks are the only things in
 * the yard in the eight mark colors (tested lit and tone mapped, white included): tan walls, a
 * brown roof, gray boxes and concrete, and no road markings, since yellow or white paint on the
 * street would read as marks. Grass and trees keep their own greens, so every flag wears a light hem
 * that sets it apart from the grass, the green flags above all.
 */

/** sRGB albedos. */
export const YARD_COLORS = {
  walls: '#aea596',
  trim: '#5d4b3c',
  roof: '#4f443b',
  door: '#5a4231',
  garageDoor: '#b9b1a3',
  glass: '#2d353e',
  /** Lit windows at night: a dim, warm lamplight, never a mark's white or yellow. */
  glassLit: '#d9b98a',
  /** Concrete a step darker than the lab's, so white paint stands out from it. */
  concrete: '#b5b9bd',
  curb: '#a9aeb4',
  fixture: '#959ba1',
  fixtureLight: '#aab0b7',
  stake: '#6f757c',
  chimney: '#8d857c',
  cap: '#2b2f36',
  /** Worn grass along edges and paths: duller than the lab's, so it never reads as yellow paint. */
  grassWorn: '#8e8b6e',
  /** Each flag's hem: part of the mark, light so the flag stands out from the grass. */
  flagHem: '#f4f2ec',
} as const;

/** How the marks are drawn: as teaching aids, larger than life, as the lab's lines are thicker. */
export const MARK_LOOK = {
  /** A flag, about five times life size: its cloth, its hem past the cloth, its stake. */
  flag: { width: 1.9, height: 1.35, hem: 0.2, stake: 3.6, stakeRadius: 0.06 },
  /** A paint dash. */
  paint: { length: 2.3, width: 0.46 },
  /** How far the other marks dim while one is asked about: a little, never the asked mark. */
  dim: 0.7,
  /** The asked mark's flags stand this much taller. */
  lift: 1.2,
  /** At night each mark keeps a faint glow of its own color, so it reads by moonlight (well under bloom). */
  nightGlow: 0.32,
  /** The light glow on the ground under each of the asked mark's flags and dashes. */
  glow: { radius: 2.7, strength: 0.42 },
  /** Which way flags face: toward the street and the right, where the camera is. */
  flagTurn: -0.55,
} as const;

/** How brightly lit windows glow at night, as emissive intensity: a dim lamplight. */
export const WINDOW_LIT = 0.55;

/** How long the ground takes to open or close along a line, in ms (at once with motion reduced). */
export const OPEN_MS = 650;
