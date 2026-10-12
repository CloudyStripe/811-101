/**
 * Captures the portal's lesson images: `npm run thumbnails`. Run it again when a lesson's look
 * changes. It serves the site with Vite's dev server, opens each lesson with its chrome hidden,
 * and saves a 960 × 540 JPEG of the 3D view, cropped to the scene, to src/pages/portal/images/.
 * It stops without saving anything wrong: on a page error, a crop outside the 3D view, or an
 * image that comes out blank.
 */
import { writeFile } from 'node:fs/promises';
import { chromium, type Page } from '@playwright/test';
import { createServer } from 'vite';
import type { Lesson } from '../content/portal.ts';

const PORT = 5199;
const BASE = `http://localhost:${String(PORT)}/811-101/`;
const OUT = 'src/pages/portal/images';
const VIEWPORT = { width: 1280, height: 720 };
/** Output width: sharp on the portal's cards, light to load. */
const WIDTH = 960;

interface Shot {
  /** The lesson image it makes, saved as <name>.jpg. */
  name: Lesson['image'];
  path: string;
  /** Gets the view ready: waits for it to load and puts away anything open over it. */
  ready: (page: Page) => Promise<void>;
  /** CSS that hides the page's chrome, so the image is the 3D view alone. */
  hide: string;
  /** The part of the 1280 × 720 view to keep, in CSS pixels; 16:9. */
  crop: { x: number; y: number; width: number };
}

type Debuggable = Window & {
  __app?: { camera: { position: { x: number; y: number; z: number } } };
};

/** Waits until the diorama's camera has stopped moving. */
async function cameraAtRest(page: Page): Promise<void> {
  let last = '';
  let still = 0;
  const deadline = Date.now() + 20_000;
  while (still < 3) {
    if (Date.now() > deadline) throw new Error('The camera never came to rest');
    const now = await page.evaluate(() => {
      const p = (window as Debuggable).__app?.camera.position;
      return p ? [p.x, p.y, p.z].map((v) => v.toFixed(3)).join(',') : '';
    });
    still = now !== '' && now === last ? still + 1 : 0;
    last = now;
    await page.waitForTimeout(200);
  }
}

const SHOTS: Shot[] = [
  {
    name: 'frequency-lab',
    path: 'training/frequency-lab/?setup=steel&f=33000&tier=high&capture',
    ready: async (page) => {
      await page.waitForFunction(() => document.documentElement.dataset.sceneReady === 'true');
      await page.getByRole('button', { name: 'Close the lab guide' }).click();
    },
    hide: '.lab-title, .lab-setup, .lab-console, .lab-panel, .labels',
    crop: { x: 0, y: 90, width: 1060 },
  },
  {
    name: 'gas-petroleum',
    // The #debug hook exposes its camera, so the script can tell when it has settled.
    path: 'utilities/gas-petroleum/#debug',
    ready: async (page) => {
      await page.waitForFunction(() => (window as Debuggable).__app !== undefined, null, {
        timeout: 60_000,
      });
      await page.locator('#p-close').click();
      await cameraAtRest(page);
    },
    hide: '.brand, .tools, .hint, #panel, #labels',
    crop: { x: 230, y: 152, width: 800 },
  },
];

/** Spread of brightness in an image; a blank capture is close to 0. */
function spreadOf(page: Page, jpeg: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let i = 0; i + 2 < data.length; i += 16) {
      const y = 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
      sum += y;
      sumSq += y * y;
      n += 1;
    }
    const mean = sum / n;
    return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  }, jpeg.toString('base64'));
}

const server = await createServer({
  server: { port: PORT, strictPort: true },
  logLevel: 'warn',
});
await server.listen();
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

try {
  for (const shot of SHOTS) {
    // Render at the scale that makes the crop come out WIDTH pixels wide.
    const page = await browser.newPage({
      viewport: VIEWPORT,
      deviceScaleFactor: WIDTH / shot.crop.width,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`${BASE}${shot.path}`);
    await shot.ready(page);

    const clip = { ...shot.crop, height: (shot.crop.width * 9) / 16 };
    const canvas = await page.locator('canvas').first().boundingBox();
    if (
      !canvas ||
      clip.x < canvas.x ||
      clip.y < canvas.y ||
      clip.x + clip.width > canvas.x + canvas.width ||
      clip.y + clip.height > canvas.y + canvas.height
    ) {
      throw new Error(`${shot.name}: the crop isn't inside the 3D view`);
    }
    const jpeg = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      animations: 'disabled',
      style: `${shot.hide} { visibility: hidden !important; }`,
      clip,
    });
    if (errors.length) throw new Error(`${shot.name}: ${errors.join(' | ')}`);
    if ((await spreadOf(page, jpeg)) < 8) throw new Error(`${shot.name}: the image is blank`);

    const path = `${OUT}/${shot.name}.jpg`;
    await writeFile(path, jpeg);
    console.log(`Wrote ${path}.`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
