/**
 * Design tokens: the one source for CSS (via the `virtual:tokens.css` module), the 3D scene
 * and the contrast tests.
 *
 * Chrome is neutral and color means utility: the UI accent is ink, and the APWA colors are
 * reserved for what they mean in the field.
 */
import { APWA, type ApwaCode } from './apwa.ts';

export type ThemeName = 'light' | 'dark';

export interface ChromeTokens {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  line: string;
  focus: string;
  accent: string;
  accentInk: string;
}

/** Colors for the 3D scene. Material albedos stay the same in both themes; sky, fog and light change. */
export interface SceneTokens {
  skyTop: string;
  skyHorizon: string;
  groundBounce: string;
  fog: string;
  sunColor: string;
  sunIntensity: number;
  envIntensity: number;
  fogDensity: number;
}

export interface Theme {
  chrome: ChromeTokens;
  scene: SceneTokens;
}

export const THEMES: Record<ThemeName, Theme> = {
  light: {
    chrome: {
      bg: '#f4f1ec',
      surface: '#fffdf9',
      surface2: '#f1ece4',
      ink: '#1c1a17',
      ink2: '#5a544c',
      line: '#d9d0c3',
      focus: '#1c1a17',
      accent: '#1c1a17',
      accentInk: '#fffdf9',
    },
    scene: {
      skyTop: '#c9d6e0',
      skyHorizon: '#efe7da',
      groundBounce: '#9a8467',
      fog: '#e8e0d3',
      sunColor: '#fff1dc',
      sunIntensity: 3.1,
      envIntensity: 0.72,
      fogDensity: 0.0018,
    },
  },
  dark: {
    chrome: {
      bg: '#14120f',
      surface: '#1e1b17',
      surface2: '#27231e',
      ink: '#f2ede5',
      ink2: '#b8afa3',
      line: '#3a342d',
      focus: '#f2ede5',
      accent: '#f2ede5',
      accentInk: '#14120f',
    },
    scene: {
      skyTop: '#131b25',
      skyHorizon: '#3a342c',
      groundBounce: '#4a3d2f',
      fog: '#26221d',
      sunColor: '#c9d7ff',
      sunIntensity: 1.5,
      envIntensity: 0.62,
      fogDensity: 0.0024,
    },
  },
};

/** Material albedos for the street block (sRGB). Earthy and controlled; no lime grass. */
export const MATERIAL_COLORS = {
  topsoil: '#5d432f',
  subsoil: '#8a6a4a',
  clay: '#ab8a62',
  deep: '#6c5846',
  backfill: '#a8916f',
  bedding: '#bba98d',
  grass: '#788f55',
  grassDark: '#5b7142',
  concrete: '#cbc4b9',
  concreteNew: '#e2ddd3',
  curb: '#c2baae',
  asphalt: '#3a3835',
  asphaltSeal: '#24221f',
  coatedSteel: '#3c3d3f',
  steel: '#8a8d90',
  graphite: '#2b2d30',
  casing: '#d8d3ca',
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
    `--ink: ${t.ink}; --ink-2: ${t.ink2}; --line: ${t.line}; --focus: ${t.focus};`,
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
    `--panel-w: 380px;`,
  ].join(' ');
  return [
    `:root { ${shared} ${light} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} } }`,
    `:root[data-theme="dark"] { ${dark} }`,
    `:root[data-theme="light"] { ${light} }`,
    `@media (prefers-reduced-motion: reduce) { :root { --dur-fast: 0ms; --dur: 0ms; --dur-slow: 0ms; } }`,
    `:root[data-motion="reduce"] { --dur-fast: 0ms; --dur: 0ms; --dur-slow: 0ms; }`,
  ].join('\n');
}
