/**
 * Each page's first paint on a slow phone: the CPU four times slower and a phone-like connection
 * (1.6 Mbps down, 150 ms latency), as the site's page changes were filmed. Its pictures are held
 * back until it has painted, and its 3D view's code with them, so what shows then is what the
 * first paint had, whatever the timing: each picture's place filled, never a blank box. A 3D
 * page's stage shows its poster's tiny copy, and the portal its hero's, where it stands beside the
 * name, and its lessons' previews'.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

/**
 * What shows a picture's place is filled: a picture (a blank box is one flat colour, perhaps with
 * a small tag on it, so most of it is of that one colour; a picture, or its tiny copy, isn't), or
 * the model's grass (the hero's place is the sky either way, a gradient).
 */
type Fill = 'picture' | 'grass';

const CASES: { name: string; path: string; places: { selector: string; fill: Fill }[] }[] = [
  {
    name: 'the portal',
    path: '',
    places: [
      // The hero's place is the sky either way: what shows it's there is the model on it.
      { selector: '.hero-image', fill: 'grass' },
      { selector: 'img.card-image', fill: 'picture' },
    ],
  },
  {
    name: 'the lab',
    path: 'training/frequency-lab/',
    places: [{ selector: '.stage', fill: 'picture' }],
  },
  {
    name: 'the diorama',
    path: 'utilities/gas-petroleum/',
    places: [{ selector: '.stage', fill: 'picture' }],
  },
];

const SIZES = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true },
] as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Throttles the page as a mid-range phone on a slow connection. */
async function throttle(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

/** A page's pictures, and its 3D view's code, by their addresses. */
const HELD = /\/(posters|stills)\/[^/]+\.webp$|\/assets\/(scene|world|vendor-3d|N8AO)-[^/]+\.js$/;

/**
 * Holds back the page's pictures, and its 3D view's code, until the returned function lets them
 * through.
 */
async function holdPictures(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(HELD, async (route) => {
    await released;
    await route.continue();
  });
  return release;
}

/** The page as it first paints, its pictures still held back: a PNG, in base64. */
async function firstPaint(page: Page, path: string): Promise<string> {
  await page.goto(path, { waitUntil: 'commit' });
  await expect
    .poll(
      () => page.evaluate(() => performance.getEntriesByName('first-contentful-paint').length),
      { message: 'the page paints', timeout: 60_000 },
    )
    .toBe(1);
  return (await page.screenshot({ timeout: 60_000 })).toString('base64');
}

/**
 * How much of each box, in a frame, is filled: for a picture, the share of its pixels that aren't
 * of its one most common colour (a blank box scores near 0, a picture near 1); for grass, the share
 * that are the green of the model's grass.
 */
function filled(page: Page, frame: string, boxes: Box[], scale: number, fill: Fill) {
  return page.evaluate(
    async ({ frame, boxes, scale, fill }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${frame}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no 2D canvas');
      ctx.drawImage(img, 0, 0);
      const k = img.width / scale;
      return boxes.map((box) => {
        const x = Math.max(0, Math.round(box.x * k));
        const y = Math.max(0, Math.round(box.y * k));
        const w = Math.min(img.width - x, Math.round(box.width * k));
        const h = Math.min(img.height - y, Math.round(box.height * k));
        if (w <= 0 || h <= 0) return 0;
        const px = ctx.getImageData(x, y, w, h).data;
        const n = px.length / 4;
        if (fill === 'picture') {
          // Colours to within 1/16 of each channel; the box's most common one.
          const counts = new Map<number, number>();
          for (let i = 0; i < px.length; i += 4) {
            const bin =
              (((px[i] ?? 0) >> 4) << 8) | (((px[i + 1] ?? 0) >> 4) << 4) | ((px[i + 2] ?? 0) >> 4);
            counts.set(bin, (counts.get(bin) ?? 0) + 1);
          }
          return 1 - Math.max(...counts.values()) / n;
        }
        let hits = 0;
        for (let i = 0; i < px.length; i += 4) {
          const r = (px[i] ?? 0) / 255;
          const g = (px[i + 1] ?? 0) / 255;
          const b = (px[i + 2] ?? 0) / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          let hue = 0;
          if (max !== min) {
            if (max === r) hue = (60 * ((g - b) / (max - min)) + 360) % 360;
            else if (max === g) hue = 60 * ((b - r) / (max - min)) + 120;
            else hue = 60 * ((r - g) / (max - min)) + 240;
          }
          if (hue >= 75 && hue <= 165 && sat > 0.25 && max > 0.12) hits++;
        }
        return hits / n;
      });
    },
    { frame, boxes, scale, fill },
  );
}

for (const size of SIZES) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`on a slow ${size.name}, ${theme}`, () => {
      test.use({
        viewport: size.viewport,
        isMobile: size.isMobile,
        hasTouch: size.isMobile,
        colorScheme: theme,
      });

      for (const c of CASES) {
        test(`${c.name} paints a place for each picture in its first frame, none of them blank`, async ({
          page,
        }) => {
          await throttle(page);
          const release = await holdPictures(page);
          const frame = await firstPaint(page, c.path);
          const width = size.viewport.width;
          for (const place of c.places) {
            const boxes = await page.locator(place.selector).evaluateAll((els) =>
              els
                .filter((el) => el.checkVisibility())
                .map((el) => {
                  const r = el.getBoundingClientRect();
                  // Only what's on the first screen.
                  return {
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: Math.min(r.height, innerHeight - r.y),
                  };
                })
                .filter((r) => r.height > 0 && r.width > 0),
            );
            // Where the hero stacks, it shows no model; the cards are always there.
            if (place.selector === '.hero-image' && boxes.length === 0) continue;
            expect(boxes.length, `${place.selector} on the first screen`).toBeGreaterThan(0);
            const shares = await filled(page, frame, boxes, width, place.fill);
            for (const [i, share] of shares.entries()) {
              expect(
                share,
                `${place.selector} #${String(i)} filled in the first frame (${share.toFixed(3)})`,
              ).toBeGreaterThan(place.fill === 'grass' ? 0.02 : 0.6);
            }
          }
          release();
          // And the pictures held back then land.
          await expect
            .poll(() =>
              page.evaluate(() =>
                performance
                  .getEntriesByType('resource')
                  .some((r) => /\/(posters|stills)\//.test(r.name)),
              ),
            )
            .toBe(true);
        });
      }
    });
  }
}
