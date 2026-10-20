/**
 * Design tokens: the one source for CSS (via the `virtual:tokens.css` module), the 3D scene
 * and the contrast tests.
 *
 * Chrome is neutral and color means utility: the UI accent is ink, and the APWA colors are
 * reserved for what they mean in the field.
 */
import { APWA, type ApwaCode } from './apwa.ts';

export type ThemeName = 'light' | 'dark';

/**
 * Interface colors: white and a cool near-black. Neutral and a little cool in both themes, so the
 * sunlit scene is the warmest, most colorful thing on screen.
 */
export interface ChromeTokens {
  /** The page. */
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  /** Muted text: captions and hints. Still 4.5:1 on every surface. */
  ink3: string;
  /** Hairlines: borders and rules. */
  line: string;
  focus: string;
  accent: string;
  accentInk: string;
  /** Behind a modal dialog. */
  scrim: string;
  /**
   * Three levels of lift, as CSS shadows: resting chrome, raised cards and popovers, modals. Each
   * is a crisp step under a soft, deep shadow, like a toy standing on a table.
   */
  elevation: readonly [string, string, string];
}

/** A directional light: its color and strength, and where it shines from. */
export interface DirectionalTokens {
  color: string;
  intensity: number;
  /** Degrees around from the scene's front (the cut face's side), positive toward +x. */
  azimuth: number;
  /** Degrees above the horizon. */
  elevation: number;
}

/**
 * How the ground's cover is drawn: lawns, plants, paths, roads and pads. By day as it is; at night
 * dimmer, grayer and cooler, so a close view reads as night and lamps' pools show warm on it. Built
 * things and the cut face keep their colors.
 */
export interface GroundGrade {
  /** How much darker, from 0 to 1. */
  dim: number;
  /** How far toward gray, from 0 to 1. */
  gray: number;
  /** The hue it leans toward. Only the hue counts: the tint never changes how bright it is. */
  tint: string;
}

/**
 * The 3D scene's sky and light. Material colors stay the same in both themes; the sky and the
 * lights change, and night lifts its light so the scene still reads.
 */
export interface SceneTokens {
  /** The sky at the top of the view. */
  skyZenith: string;
  /** The sky across the middle of the view, behind the model. */
  skyHorizon: string;
  /** The bottom of the view, under the model: the sky carries on, so the model floats in it. */
  skyBelow: string;
  /** The key light (sun or moon), the only one that casts shadows. */
  key: DirectionalTokens;
  /** Sky and ground fill. The ground's color also lights the environment's lower half. */
  hemisphere: { sky: string; ground: string; intensity: number };
  /** A light from behind that rims edges and separates forms from the sky. */
  rim: DirectionalTokens;
  envIntensity: number;
  /**
   * The environment's soft panel on the key light's side, as a multiple of the key's color: the
   * broad highlight along pipes, tanks and rounded edges.
   */
  softbox: number;
  /** Scales every light at once. */
  exposure: number;
  /** A faint glow of each buried line's own tint, so its color still reads in dim light. */
  lineGlow: number;
  /** Street lamps and lit windows: off by day, on at night. */
  lamps: number;
  /** What stops off the chosen path fade toward: a quiet gray, never the sky's blue. */
  fade: string;
  ground: GroundGrade;
}

export interface Theme {
  chrome: ChromeTokens;
  scene: SceneTokens;
}

/**
 * Where each of the sky's colors sits, from the top of the view (0) to the bottom (1): the 3D
 * backdrop's gradient (src/kit3d/backdrop.ts), and the page's own sky around a still of it.
 */
export const SKY_STOPS = { zenith: 0, horizon: 0.62, below: 1 } as const;

export const THEMES: Record<ThemeName, Theme> = {
  light: {
    chrome: {
      bg: '#f2f5f9',
      surface: '#ffffff',
      surface2: '#eef2f6',
      ink: '#121720',
      ink2: '#454e5c',
      ink3: '#59626f',
      line: '#d8dfe7',
      focus: '#121720',
      accent: '#121720',
      accentInk: '#ffffff',
      scrim: 'rgb(12 18 28 / 0.45)',
      elevation: [
        '0 2px 0 rgb(12 18 28 / 0.05), 0 8px 22px rgb(12 18 28 / 0.12)',
        '0 2px 0 rgb(12 18 28 / 0.05), 0 14px 34px rgb(12 18 28 / 0.16)',
        '0 4px 10px rgb(12 18 28 / 0.1), 0 28px 70px rgb(12 18 28 / 0.24)',
      ],
    },
    scene: {
      skyZenith: '#3d8fe0',
      skyHorizon: '#cfe6fb',
      skyBelow: '#e1effc',
      // A low, warm afternoon sun from the west, for long shadows.
      key: { color: '#ffe4bd', intensity: 3.0, azimuth: -68, elevation: 32 },
      // Fill low enough that shade stays well under sunlight, so the long shadows read. The rim
      // comes low from behind, to edge forms against the sky without filling the shade.
      hemisphere: { sky: '#bcdcff', ground: '#b9a993', intensity: 0.3 },
      rim: { color: '#ffffff', intensity: 0.35, azimuth: 150, elevation: 15 },
      envIntensity: 0.35,
      softbox: 1.5,
      exposure: 1,
      lineGlow: 0,
      lamps: 0,
      fade: '#d9dde3',
      ground: { dim: 0, gray: 0, tint: '#ffffff' },
    },
  },
  dark: {
    chrome: {
      bg: '#0b0f15',
      surface: '#141a22',
      surface2: '#1c232d',
      ink: '#eef2f7',
      ink2: '#adb6c3',
      ink3: '#97a1ae',
      line: '#29323e',
      focus: '#eef2f7',
      accent: '#eef2f7',
      accentInk: '#0b0f15',
      scrim: 'rgb(0 0 0 / 0.6)',
      elevation: [
        '0 2px 0 rgb(0 0 0 / 0.25), 0 8px 22px rgb(0 0 0 / 0.35)',
        '0 2px 0 rgb(0 0 0 / 0.3), 0 14px 34px rgb(0 0 0 / 0.42)',
        '0 4px 10px rgb(0 0 0 / 0.4), 0 28px 70px rgb(0 0 0 / 0.6)',
      ],
    },
    scene: {
      // A deep night blue, darkest under the model, so the moonlit model stands clear of it.
      skyZenith: '#0b1c44',
      skyHorizon: '#11275a',
      skyBelow: '#091530',
      // Bright moonlight: the model reads well clear of the night sky.
      key: { color: '#c3d4ff', intensity: 2.1, azimuth: -30, elevation: 50 },
      hemisphere: { sky: '#3a5a9a', ground: '#2a3b2a', intensity: 0.9 },
      rim: { color: '#ffd9a0', intensity: 0.6, azimuth: 150, elevation: 24 },
      envIntensity: 0.45,
      softbox: 1.6,
      exposure: 1.3,
      lineGlow: 0.22,
      lamps: 1,
      fade: '#3a4250',
      // Moonlit grass: darker and grayer, cooled by the moon, still grass. Lamps' pools show on it.
      ground: { dim: 0.4, gray: 0.45, tint: '#eef2f8' },
    },
  },
};

/** Where the lab's key light comes from, degrees round from its cut face: see labSceneTokens. */
const LAB_KEY_AZIMUTH: Record<ThemeName, number> = { light: -60, dark: -15 };

/**
 * The lab's sky and light. The lab looks square at its cut face, so its sun or moon swings a little
 * toward the front, and the face stays lit.
 */
export function labSceneTokens(theme: ThemeName): SceneTokens {
  const scene = THEMES[theme].scene;
  return { ...scene, key: { ...scene.key, azimuth: LAB_KEY_AZIMUTH[theme] } };
}

/**
 * Material albedos for the street block (sRGB): rich soils, crisp concrete and fresh grass, like
 * a painted model. Lit, none of them reads as a color of the code (checked in tokens.test.ts).
 */
export const MATERIAL_COLORS = {
  topsoil: '#5c3a22',
  subsoil: '#8f5f38',
  // A dusty clay: warm, but well clear of the telecom cable's orange, one layer up.
  clay: '#9c7058',
  gravel: '#9b8b78',
  rock: '#4f4239',
  // The trench's fill: a gray sand, so the yellow gas main in it stands out by value as well as hue.
  backfill: '#a89880',
  grass: '#56a733',
  // Tufts: a little lighter than the grass, so they read as texture, not as spots.
  grassLight: '#6dbb3f',
  /** Big, soft patches across a lawn, so it never looks mown flat like a golf course. */
  grassPatch: '#7cb53f',
  /** A worn band along kerbs, paths and edges, where feet and mowers wear the grass thin. */
  grassWorn: '#a29d5c',
  concrete: '#dfe3e8',
  concreteNew: '#eef1f4',
  curb: '#d0d6dd',
  asphalt: '#3b414a',
  asphaltSeal: '#262a31',
  coatedSteel: '#3d4148',
  steel: '#a6adb6',
  graphite: '#2b2f36',
  casing: '#e9ecef',
} as const;

/** The world around the block: homes, trees, shrubs and street lights, in fresh, sunny colors. */
export const WORLD_COLORS = {
  lawn: MATERIAL_COLORS.grass,
  foliage: '#3f9a3c',
  foliageDark: '#2c7a33',
  shrub: '#33873a',
  trunk: '#7a5236',
  walls: ['#ffffff', '#ffe8d4', '#e2f0ff', '#e4f5df'],
  roofs: ['#d0623f', '#4f7396', '#6b4c3b'],
  trim: '#ffffff',
  window: '#36475c',
  windowLit: '#ffcf70',
  pole: '#8a929c',
  lamp: '#fff1cf',
  lampHousing: '#3a3f47',
} as const;

/**
 * The Gas & Petroleum diorama's albedos (sRGB): the layers its block cuts through, what flows in
 * them and in its routes, and its machines. Water is never APWA blue, which means drinking water,
 * but for the open sea, a natural blue well apart from it; produced water is a murky brown-gray,
 * never APWA green, which means sewer.
 */
export const DIORAMA_COLORS = {
  // The layers, top to bottom.
  soil: '#6b4428',
  /** Sand holding fresh groundwater: a pale sand, never blue. */
  aquifer: '#c8bea2',
  overburden: '#a06b48',
  /** The tight cap rock that seals oil and gas in: a dark slate. */
  capRock: '#5a514a',
  shale: '#958775',
  /** Dark, rich source rock, where oil and gas form. */
  sourceRock: '#40342c',
  basement: '#7c7067',
  // What fills the reservoir rock, by weight: gas on top, then oil, then salty water.
  gasZone: '#efe7d6',
  oilZone: '#2c1f17',
  waterZone: '#8c7b65',
  // What flows along the routes.
  oil: '#1f1712',
  /** Natural gas: a pale, warm neutral. */
  gas: '#f4f0e8',
  /** Salty water from the well: murky brown-gray. */
  producedWater: '#7c6a55',
  /** Finished fuel: a deep amber, well apart from the paths' APWA yellow, even in shade. */
  fuel: '#8f7650',
  // The harbor.
  sea: '#2f8fd2',
  seabed: '#dcc99d',
  // The refinery tower's fuels, heavy to light: a ramp of values. Gasoline's band is its path's.
  asphalt: '#2f2a26',
  heavyOil: '#5b4b3d',
  diesel: '#8c7762',
  jetFuel: '#b9a78c',
  lightGases: '#e8dfcf',
  // Machines and buildings: white tanks and light machines, told apart by value, not hue.
  machine: '#e3e7ec',
  machineDark: '#4a525e',
  tank: '#f6f8fb',
  shell: '#dfe7ee',
  steel: '#a9b1ba',
  graphite: '#2b2f36',
  concrete: '#dfe3e8',
  pad: '#cfd6dd',
  /** Brick and stonework: a neutral, so the jetty never reads as a color of the code. */
  brick: '#a39d95',
  roof: '#c4563f',
  wall: '#f5f3ef',
  truck: '#eef2f6',
  // Small things: fossils in the source rock, sand grains, sea life, glass.
  fossil: '#efe5d0',
  sand: '#dbc89b',
  sandDark: '#bea478',
  plankton: '#d2e3ba',
  glass: '#dfe9ef',
  // Fire, and the glow of what burns: emitters, the only things bright enough to bloom.
  flame: '#ffb35c',
  flameCore: '#ffe3a6',
  furnaceGlow: '#ff9a4d',
} as const;

/** Icon ink on APWA color chips: dark on every chip, in both themes. */
export const CHIP_INK = '#1b1a17';

/**
 * The locate signal's own color: a luminous cyan, chosen to sit well away from every APWA hue
 * (checked in tokens.test.ts). Strength is shown by brightness (on the telecom cable, by how bright
 * and how wide its bands are), never by a change of color.
 */
export const SIGNAL_COLOR = '#4fe3ff';

/**
 * How far a buried line's color goes toward its APWA color from its material's: almost all the
 * way, so each line reads as its code at a glance. Still a teaching aid: real pipe and cable
 * color underground is unreliable.
 */
export const FACILITY_TINT_STRENGTH = 0.96;

/**
 * How surfaces are finished, like a painted model: glossy paint with a clear coat on built
 * things; matte on what grows or lies on the ground (soil, grass, foliage, roofs, roads); and
 * metal on steel. Boxes in the diorama are rounded up to `bevel`, in its units.
 */
export const FINISH = {
  paint: { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 },
  matte: { roughness: 0.92 },
  metal: { roughness: 0.34, metalness: 0.55 },
  bevel: 0.2,
} as const;

export const TYPE = {
  display: '"Archivo Variable", "Archivo", "Arial Narrow", "Helvetica Neue", Arial, sans-serif',
  body: '"Atkinson Hyperlegible", "Segoe UI", system-ui, -apple-system, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
} as const;

/**
 * Type sizes, phone to desktop. In rem, so text follows the reader's own font size; fluid in
 * between, so there are no jumps at breakpoints.
 */
export const TYPE_SCALE = {
  /** The portal's name, set as the wordmark. 36 to 64 px. */
  display: 'clamp(2.25rem, 1.5rem + 3.2vw, 4rem)',
  /** The portal's line under its name. 17 to 22 px. */
  lede: 'clamp(1.0625rem, 0.95rem + 0.5vw, 1.375rem)',
  /** A page's title. 22 to 28 px. */
  h1: 'clamp(1.375rem, 1.2rem + 0.75vw, 1.75rem)',
  /** Sections. 20 to 22 px. */
  h2: 'clamp(1.25rem, 1.15rem + 0.35vw, 1.375rem)',
  /** Cards. 16 to 18 px. */
  h3: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)',
  /** Reading text. 15 to 16 px. */
  body: 'clamp(0.9375rem, 0.9rem + 0.15vw, 1rem)',
  /** Captions and notes. 13 px. */
  small: '0.8125rem',
  /** Mono eyebrows and readouts, upper case. 12 px. */
  eyebrow: '0.75rem',
} as const;

/** Spacing steps, in px: everything sits on a 4 px base. */
export const SPACE = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96] as const;

/** The in-and-out curve's control points, shared by CSS and the moves the 3D view draws itself. */
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/**
 * Motion, in ms. Every move eases in and out; reduced motion makes the CSS durations zero, and
 * camera moves become cuts.
 */
export const MOTION = {
  micro: 120,
  ui: 200,
  panel: 320,
  /**
   * About how long a camera move takes to settle: to a place (a stop, a step, back to the view's
   * own framing), and the view following a drag.
   */
  settle: { move: 350, drag: 120 },
  /** The establishing move on arrival, at most; any input skips it. */
  establish: 2500,
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  easeInOut: `cubic-bezier(${EASE_IN_OUT.join(', ')})`,
} as const;

/** `MOTION.easeInOut` as a function of time (0 to 1), for moves the 3D view draws itself. */
export function easeInOut(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const [x1, y1, x2, y2] = EASE_IN_OUT;
  const at = (a: number, b: number, u: number) =>
    3 * a * u * (1 - u) ** 2 + 3 * b * u ** 2 * (1 - u) + u ** 3;
  // Find where along the curve its x reaches t; its y there is the progress.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < t) lo = mid;
    else hi = mid;
  }
  return at(y1, y2, (lo + hi) / 2);
}

/** Stacking order: the 3D view, chrome over it, the site header, popovers, the perf HUD. */
export const LAYER = { scene: 0, chrome: 10, header: 20, popover: 40, hud: 50 } as const;

/**
 * At most this many 3D labels show at once: fewer in a narrow view, so the scene leads. In a view
 * shorter than `iconsBelow`, as on a phone with its guide open, they show as their icons.
 */
export const LABEL_LIMITS = { narrow: 4, wide: 7, narrowBelow: 600, iconsBelow: 260 } as const;

function chromeVars(t: ChromeTokens, theme: ThemeName): string {
  const apwa = (Object.keys(APWA) as ApwaCode[])
    .map((code) => {
      const c = APWA[code];
      return `--apwa-${code}: ${c.fill}; --apwa-${code}-ink: ${c.ink[theme]}; --apwa-${code}-soft: ${c.soft[theme]};`;
    })
    .join(' ');
  return [
    `--bg: ${t.bg}; --surface: ${t.surface}; --surface-2: ${t.surface2};`,
    `--ink: ${t.ink}; --ink-2: ${t.ink2}; --ink-3: ${t.ink3}; --line: ${t.line}; --focus: ${t.focus};`,
    `--accent: ${t.accent}; --accent-ink: ${t.accentInk}; --scrim: ${t.scrim};`,
    `--shadow-1: ${t.elevation[0]}; --shadow-2: ${t.elevation[1]}; --shadow-3: ${t.elevation[2]};`,
    apwa,
    `color-scheme: ${theme};`,
  ].join(' ');
}

/** The CSS durations for micro, UI and panel moves; all zero when motion is reduced. */
function durations(moving: boolean): string {
  const ms = (n: number) => (moving ? `${String(n)}ms` : '0ms');
  return `--dur-fast: ${ms(MOTION.micro)}; --dur: ${ms(MOTION.ui)}; --dur-slow: ${ms(MOTION.panel)};`;
}

/** The diorama's sky, so the page can carry it on around a still of the model (the portal). */
function skyVars(s: SceneTokens): string {
  return `--sky-zenith: ${s.skyZenith}; --sky-horizon: ${s.skyHorizon}; --sky-below: ${s.skyBelow};`;
}

/** CSS custom properties for both themes: OS preference by default, `data-theme` to override. */
export function tokensCss(): string {
  const light = `${chromeVars(THEMES.light.chrome, 'light')} ${skyVars(THEMES.light.scene)}`;
  const dark = `${chromeVars(THEMES.dark.chrome, 'dark')} ${skyVars(THEMES.dark.scene)}`;
  // --space-N is N × 4 px, for each step on the scale.
  const space = SPACE.map((px) => `--space-${String(px / 4)}: ${String(px)}px;`).join(' ');
  const type = Object.entries(TYPE_SCALE)
    .map(([name, size]) => `--text-${name}: ${size};`)
    .join(' ');
  const layers = Object.entries(LAYER)
    .map(([name, z]) => `--layer-${name}: ${String(z)};`)
    .join(' ');
  const shared = [
    `--font-display: ${TYPE.display}; --font-body: ${TYPE.body}; --font-mono: ${TYPE.mono};`,
    type,
    `--signal: ${SIGNAL_COLOR}; --chip-ink: ${CHIP_INK}; --soil: ${MATERIAL_COLORS.subsoil};`,
    // The ground's layers, top down, for drawings in the page (the 404, the portal).
    `--strata-1: ${MATERIAL_COLORS.topsoil}; --strata-2: ${MATERIAL_COLORS.subsoil}; --strata-3: ${MATERIAL_COLORS.clay};`,
    space,
    `--radius-sm: 10px; --radius-md: 16px; --radius-lg: 24px; --radius-pill: 999px;`,
    durations(true),
    `--ease: ${MOTION.ease}; --ease-in-out: ${MOTION.easeInOut};`,
    layers,
    `--panel-w: clamp(19rem, 27vw, 24rem);`,
    `--sky-horizon-at: ${String(SKY_STOPS.horizon * 100)}%;`,
  ].join(' ');
  return [
    `:root { ${shared} ${light} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} } }`,
    `:root[data-theme="dark"] { ${dark} }`,
    `:root[data-theme="light"] { ${light} }`,
    `@media (prefers-reduced-motion: reduce) { :root { ${durations(false)} } }`,
    `:root[data-motion="reduce"] { ${durations(false)} }`,
    // Chosen in Settings, full motion overrides the device's preference.
    `:root[data-motion="full"] { ${durations(true)} }`,
  ].join('\n');
}
