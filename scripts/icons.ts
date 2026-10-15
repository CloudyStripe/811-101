/**
 * Renders the favicons from the mark (src/design/mark.ts): `npm run icons`. Writes
 * public/favicon.svg (ink on light browser chrome, chalk on dark), a 32 px PNG for browsers
 * without SVG icons, and a 180 px apple-touch-icon, full-bleed and opaque as iOS wants.
 */
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { MARK, markFavicon, markFile } from '../src/design/mark.ts';
import { THEMES } from '../src/design/tokens.ts';

const light = { tile: THEMES.light.chrome.ink, cut: THEMES.light.chrome.bg };
const dark = { tile: THEMES.dark.chrome.ink, cut: THEMES.dark.chrome.bg };

await writeFile('public/favicon.svg', `${markFavicon(light, dark)}\n`);

/** The mark filling a square edge to edge, for the home-screen icon: no inset tile, no corners. */
function fullBleed(size: number): string {
  const p = MARK.pipe;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="0 0 32 32">`,
    `<rect x="0" y="0" width="32" height="32" fill="${light.tile}"/>`,
    `<path d="${MARK.lines}" fill="none" stroke="${light.cut}" stroke-width="${String(MARK.stroke)}" stroke-linecap="round"/>`,
    `<circle cx="${String(p.cx)}" cy="${String(p.cy)}" r="${String(p.r)}" fill="${light.tile}" stroke="${light.cut}" stroke-width="${String(MARK.stroke)}"/>`,
    '</svg>',
  ].join('');
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [file, svg, size] of [
    ['public/favicon-32.png', markFile(light, 32), 32],
    ['public/apple-touch-icon.png', fullBleed(180), 180],
  ] as const) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
    await page.locator('svg').screenshot({ path: file, omitBackground: true });
    console.log(`Wrote ${file}.`);
  }
} finally {
  await browser.close();
}
