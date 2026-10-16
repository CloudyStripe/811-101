/**
 * Renders the favicons from the wordmark tile (scripts/wordmark.ts): part of `npm run icons`. An
 * SVG favicon can't load a web font, so the tile is drawn in Chromium and written as pictures:
 * - public/favicon.svg holds two of them, ink on light browser chrome and chalk on dark, and shows
 *   the one that suits;
 * - public/favicon-32.png is for browsers without SVG icons;
 * - public/apple-touch-icon.png fills its square edge to edge, opaque, as iOS wants.
 */
import { writeFile } from 'node:fs/promises';
import { chromium, type Page } from '@playwright/test';
import {
  TILE_COLORS,
  WORDMARK_HTML,
  archivoFace,
  wordmarkCss,
  type TileColors,
} from './wordmark.ts';

const face = await archivoFace();

async function render(page: Page, size: number, colors: TileColors, rounded = true) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><head><style>${face}
html, body { margin: 0; background: transparent; }
${wordmarkCss(size, colors, rounded)}</style></head><body>${WORDMARK_HTML}</body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  return page.locator('.wordmark').screenshot({ omitBackground: true });
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const image = (png: Buffer, theme: string) =>
    `<image class="${theme}" width="128" height="128" href="data:image/png;base64,${png.toString('base64')}"/>`;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">',
    '<style>.dark{display:none}@media (prefers-color-scheme:dark){.light{display:none}.dark{display:inline}}</style>',
    image(await render(page, 128, TILE_COLORS.light), 'light'),
    image(await render(page, 128, TILE_COLORS.dark), 'dark'),
    '</svg>',
  ].join('');
  await writeFile('public/favicon.svg', `${svg}\n`);
  console.log('Wrote public/favicon.svg.');
  await writeFile('public/favicon-32.png', await render(page, 32, TILE_COLORS.light));
  console.log('Wrote public/favicon-32.png.');
  await writeFile('public/apple-touch-icon.png', await render(page, 180, TILE_COLORS.light, false));
  console.log('Wrote public/apple-touch-icon.png.');
} finally {
  await browser.close();
}
