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
 * Interface colors. Day is ink on warm paper; night is chalk on cool graphite. Each theme keeps
 * one temperature, so panels and the scene behind them never clash.
 */
export interface ChromeTokens {
  /** The page, and the paper the 3D section is drawn on. */
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
   * Three levels of lift, as CSS shadows: resting chrome, raised cards and popovers, modals. By
   * day a soft shadow under a hairline; by night almost none, since dark surfaces lift by tone.
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
 * The 3D scene's sky, light and atmosphere. Material albedos stay the same in both themes; the
 * sky, fog and lights change, and night lifts its light so the scene still reads.
 */
export interface SceneTokens {
  /** Sky straight overhead. */
  skyZenith: string;
  /** Sky at the horizon; the fog fades into this. */
  skyHorizon: string;
  /**
   * Below the horizon, in front of the section: the paper it's drawn on. The page's own color,
   * so the scene sits on the page with no seam.
   */
  paper: string;
  /** A soft glow in the sky behind the scene, where the rim light comes from. */
  glow: string;
  /**
   * How much fog lies over the farthest point the lesson needs, from 0 to 1. The density follows
   * from the camera's distance, so the far end reads the same at every size.
   */
  fogAtFar: number;
  /** The key light (sun or moon), the only one that casts shadows. */
  key: DirectionalTokens;
  /** Sky and ground fill. */
  hemisphere: { sky: string; ground: string; intensity: number };
  /** A light from behind that rims edges and separates forms from the background. */
  rim: DirectionalTokens;
  envIntensity: number;
  /** Scales every light at once. */
  exposure: number;
  /** A faint glow of each buried line's own tint, so its color still reads in dim light. */
  lineGlow: number;
  /** Street lamps and lit windows: off by day, on at night. */
  lamps: number;
  /** The ink line drawn along the section's layer boundaries. */
  edge: string;
}

export interface Theme {
  chrome: ChromeTokens;
  scene: SceneTokens;
}

/** The page in each theme: the chrome's background, and the paper the 3D section stands on. */
const PAGE = { light: '#f2efe9', dark: '#111315' } as const;

export const THEMES: Record<ThemeName, Theme> = {
  light: {
    chrome: {
      bg: PAGE.light,
      surface: '#fbfaf7',
      surface2: '#ece8e0',
      ink: '#1b1a17',
      ink2: '#57534b',
      ink3: '#6b665d',
      line: '#d9d3c8',
      focus: '#1b1a17',
      accent: '#1b1a17',
      accentInk: '#fbfaf7',
      scrim: 'rgb(27 26 23 / 0.45)',
      elevation: [
        '0 1px 2px rgb(27 26 23 / 0.06), 0 4px 14px rgb(27 26 23 / 0.07)',
        '0 1px 2px rgb(27 26 23 / 0.06), 0 10px 28px rgb(27 26 23 / 0.11)',
        '0 2px 6px rgb(27 26 23 / 0.08), 0 24px 64px rgb(27 26 23 / 0.2)',
      ],
    },
    scene: {
      skyZenith: '#c4d4de',
      skyHorizon: '#ece8df',
      paper: PAGE.light,
      glow: '#fff3da',
      fogAtFar: 0.14,
      key: { color: '#fff0d8', intensity: 3.0, azimuth: -40, elevation: 40 },
      hemisphere: { sky: '#dfe8ee', ground: '#b9a88e', intensity: 0.45 },
      rim: { color: '#fff8ec', intensity: 0.7, azimuth: 150, elevation: 24 },
      envIntensity: 0.62,
      exposure: 1,
      lineGlow: 0,
      lamps: 0,
      edge: '#2a2621',
    },
  },
  dark: {
    chrome: {
      bg: PAGE.dark,
      surface: '#181b1e',
      surface2: '#20242a',
      ink: '#ece9e2',
      ink2: '#a9a49a',
      ink3: '#949086',
      line: '#2d3238',
      focus: '#ece9e2',
      accent: '#ece9e2',
      accentInk: '#111315',
      scrim: 'rgb(0 0 0 / 0.6)',
      elevation: [
        '0 1px 2px rgb(0 0 0 / 0.28)',
        '0 1px 2px rgb(0 0 0 / 0.3), 0 10px 28px rgb(0 0 0 / 0.32)',
        '0 2px 6px rgb(0 0 0 / 0.4), 0 24px 64px rgb(0 0 0 / 0.55)',
      ],
    },
    scene: {
      skyZenith: '#0a0f14',
      skyHorizon: '#1c2630',
      paper: PAGE.dark,
      glow: '#8fa8c8',
      fogAtFar: 0.18,
      key: { color: '#b9cbe8', intensity: 1.7, azimuth: 30, elevation: 52 },
      hemisphere: { sky: '#3a4d63', ground: '#3a332c', intensity: 0.85 },
      rim: { color: '#8db0dc', intensity: 1.1, azimuth: 160, elevation: 22 },
      envIntensity: 0.5,
      exposure: 1.4,
      lineGlow: 0.22,
      lamps: 1,
      edge: '#9c968b',
    },
  },
};

/**
 * Material albedos for the street block (sRGB). Earthy and muted, so the APWA tints and the signal
 * stay the most saturated things on screen (checked in tokens.test.ts).
 */
export const MATERIAL_COLORS = {
  topsoil: '#5f4532',
  subsoil: '#86684b',
  // A cool, dusty clay: well clear of the telecom cable's orange, one layer up.
  clay: '#9a8069',
  gravel: '#8f897e',
  rock: '#686460',
  backfill: '#ab9677',
  grass: '#8c9870',
  // Tufts on the verge: a little lighter than it, so they read as texture, not as spots.
  grassLight: '#99a47c',
  concrete: '#cdc8be',
  concreteNew: '#e2ddd3',
  curb: '#c2bcb1',
  asphalt: '#3b3d40',
  asphaltSeal: '#25272a',
  coatedSteel: '#3c3d3f',
  steel: '#8a8d90',
  graphite: '#2b2d30',
  casing: '#d8d3ca',
} as const;

/** The world around the block: homes, trees and street lights, all as muted as the block. */
export const WORLD_COLORS = {
  lawn: '#88946f',
  foliage: '#717e5c',
  foliageDark: '#58664a',
  trunk: '#6e5a48',
  walls: ['#cfc8bb', '#c3bbad', '#d4cdc1', '#bdb5a8'],
  roofs: ['#64605b', '#716760', '#585b60'],
  trim: '#f3f0ea',
  window: '#5a6066',
  windowLit: '#ffd9a0',
  pole: '#7b7f84',
  lamp: '#fff1d6',
  lampHousing: '#3f4246',
} as const;

/** Icon ink on APWA color chips: dark on every chip, in both themes. */
export const CHIP_INK = '#1b1a17';

/**
 * The locate signal's own color: a luminous cyan, chosen to sit well away from every APWA hue
 * (checked in tokens.test.ts). Strength is shown by brightness, never by a change of color.
 */
export const SIGNAL_COLOR = '#4fe3ff';

/** How far a line's tint is pulled toward the material color, so tints read as a teaching aid. */
export const FACILITY_TINT_STRENGTH = 0.78;

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
  /** The portal's statement. 36 to 64 px. */
  display: 'clamp(2.25rem, 1.5rem + 3.2vw, 4rem)',
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

/**
 * Motion, in ms. Every move eases in and out; reduced motion makes the CSS durations zero, and
 * camera moves become cuts.
 */
export const MOTION = {
  micro: 120,
  ui: 200,
  panel: 320,
  /** Camera flights, scaled by distance between these. */
  flight: [900, 1600],
  /** The establishing move on arrival, at most; any input skips it. */
  establish: 2500,
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
} as const;

/** Stacking order: the 3D view, chrome over it, the site header, popovers, the perf HUD. */
export const LAYER = { scene: 0, chrome: 10, header: 20, popover: 40, hud: 50 } as const;

/** At most this many 3D labels show at once: fewer in a narrow view, so the scene leads. */
export const LABEL_LIMITS = { narrow: 4, wide: 7, narrowBelow: 600 } as const;

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

/** CSS custom properties for both themes: OS preference by default, `data-theme` to override. */
export function tokensCss(): string {
  const light = chromeVars(THEMES.light.chrome, 'light');
  const dark = chromeVars(THEMES.dark.chrome, 'dark');
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
    `--radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-pill: 999px;`,
    durations(true),
    `--ease: ${MOTION.ease}; --ease-in-out: ${MOTION.easeInOut};`,
    layers,
    `--panel-w: clamp(19rem, 27vw, 24rem);`,
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
