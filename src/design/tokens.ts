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
  /** Below the horizon, in front of the section: the paper it's drawn on. */
  paper: string;
  /** A soft glow in the sky around the key light: the sun by day, the moon by night. */
  glow: string;
  /** Exponential fog density, per scene unit (feet in the lab). */
  fogDensity: number;
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

export const THEMES: Record<ThemeName, Theme> = {
  light: {
    chrome: {
      bg: '#f2efe9',
      surface: '#fbfaf7',
      surface2: '#ece8e0',
      ink: '#1b1a17',
      ink2: '#57534b',
      ink3: '#6b665d',
      line: '#d9d3c8',
      focus: '#1b1a17',
      accent: '#1b1a17',
      accentInk: '#fbfaf7',
    },
    scene: {
      skyZenith: '#c4d4de',
      skyHorizon: '#ece8df',
      paper: '#f2efe9',
      glow: '#fff3da',
      fogDensity: 0.0032,
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
      bg: '#111315',
      surface: '#181b1e',
      surface2: '#20242a',
      ink: '#ece9e2',
      ink2: '#a9a49a',
      ink3: '#949086',
      line: '#2d3238',
      focus: '#ece9e2',
      accent: '#ece9e2',
      accentInk: '#111315',
    },
    scene: {
      skyZenith: '#0a0f14',
      skyHorizon: '#1c2630',
      paper: '#111315',
      glow: '#8fa8c8',
      fogDensity: 0.0036,
      key: { color: '#b9cbe8', intensity: 1.7, azimuth: 30, elevation: 52 },
      hemisphere: { sky: '#3a4d63', ground: '#2b2622', intensity: 0.85 },
      rim: { color: '#8db0dc', intensity: 1.1, azimuth: 160, elevation: 22 },
      envIntensity: 0.5,
      exposure: 1.3,
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
  clay: '#a27a5b',
  gravel: '#8f897e',
  rock: '#686460',
  backfill: '#ab9677',
  grass: '#8a9a66',
  grassDark: '#66764c',
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
  lawn: '#87966a',
  foliage: '#6f7f57',
  foliageDark: '#58664a',
  trunk: '#6e5a48',
  walls: ['#cfc8bb', '#c3bbad', '#d4cdc1', '#bdb5a8'],
  roofs: ['#64605b', '#716760', '#585b60'],
  trim: '#f3f0ea',
  window: '#5a6066',
  windowLit: '#ffd9a0',
  pole: '#7b7f84',
  lamp: '#fff1d6',
} as const;

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
    `--accent: ${t.accent}; --accent-ink: ${t.accentInk};`,
    apwa,
    `color-scheme: ${theme};`,
  ].join(' ');
}

/** CSS custom properties for both themes: OS preference by default, `data-theme` to override. */
export function tokensCss(): string {
  const light = chromeVars(THEMES.light.chrome, 'light');
  const dark = chromeVars(THEMES.dark.chrome, 'dark');
  const shared = [
    `--font-display: ${TYPE.display}; --font-body: ${TYPE.body}; --font-mono: ${TYPE.mono};`,
    `--signal: ${SIGNAL_COLOR};`,
    `--space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 20px; --space-6: 24px; --space-8: 32px;`,
    `--radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-pill: 999px;`,
    `--dur-fast: 120ms; --dur: 220ms; --dur-slow: 360ms; --ease: cubic-bezier(0.2, 0.8, 0.2, 1);`,
    `--panel-w: clamp(19rem, 27vw, 24rem);`,
  ].join(' ');
  return [
    `:root { ${shared} ${light} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} } }`,
    `:root[data-theme="dark"] { ${dark} }`,
    `:root[data-theme="light"] { ${light} }`,
    `@media (prefers-reduced-motion: reduce) { :root { --dur-fast: 0ms; --dur: 0ms; --dur-slow: 0ms; } }`,
    `:root[data-motion="reduce"] { --dur-fast: 0ms; --dur: 0ms; --dur-slow: 0ms; }`,
    // Chosen in Settings, full motion overrides the device's preference.
    `:root[data-motion="full"] { --dur-fast: 120ms; --dur: 220ms; --dur-slow: 360ms; }`,
  ].join('\n');
}
