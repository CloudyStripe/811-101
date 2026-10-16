/**
 * The wordmark tile: the site's name in two lines, "811 / 101", set in Archivo, heavy and wide,
 * on a rounded ink tile. The favicons (scripts/icons.ts) and share previews (scripts/thumbnails.ts)
 * draw it in Chromium, with the font embedded.
 */
import { readFile } from 'node:fs/promises';
import { THEMES } from '../src/design/tokens.ts';

const FONT = 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2';

/** The tile's colors: ink with white type for light pages, chalk with near-black type for dark. */
export const TILE_COLORS = {
  light: { tile: THEMES.light.chrome.ink, type: THEMES.light.chrome.surface },
  dark: { tile: THEMES.dark.chrome.ink, type: THEMES.dark.chrome.bg },
} as const;

export type TileColors = (typeof TILE_COLORS)[keyof typeof TILE_COLORS];

/** The display face as an embedded @font-face, named `family`. */
export async function archivoFace(family = 'Archivo Variable'): Promise<string> {
  const data = (await readFile(FONT)).toString('base64');
  return `@font-face { font-family: "${family}"; src: url(data:font/woff2;base64,${data}) format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }`;
}

/** CSS for a `.wordmark` tile `size` px square: rounded, or full bleed for a home-screen icon. */
export function wordmarkCss(size: number, colors: TileColors, rounded = true): string {
  return `.wordmark {
  box-sizing: border-box;
  display: grid;
  flex: none;
  place-content: center;
  width: ${String(size)}px;
  height: ${String(size)}px;
  border-radius: ${rounded ? String(size * 0.22) : '0'}px;
  background: ${colors.tile};
  color: ${colors.type};
  font: 900 ${String(size * 0.39)}px/0.86 "Archivo Variable";
  font-stretch: 112%;
  letter-spacing: -0.01em;
  text-align: center;
}`;
}

/** The tile's markup, hidden from readers: the name is said in text beside it. */
export const WORDMARK_HTML = '<div class="wordmark" aria-hidden="true">811<br>101</div>';
