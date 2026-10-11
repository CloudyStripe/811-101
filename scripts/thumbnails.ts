/**
 * Captures the portal's lesson images: `npm run thumbnails`. Run it again when a lesson's look
 * changes. It serves the site with Vite's dev server, opens each lesson with its chrome hidden,
 * and saves a 960 × 540 JPEG of the 3D view, cropped to the scene, to src/pages/portal/images/.
 */
import { chromium, type Page } from '@playwright/test';
import { createServer } from 'vite';

const PORT = 5199;
const BASE = `http://localhost:${String(PORT)}/811-101/`;
const OUT = 'src/pages/portal/images';
const VIEWPORT = { width: 1280, height: 720 };
/** Output width: sharp on the portal's cards, light to load. */
const WIDTH = 960;

interface Shot {
  name: string;
  path: string;
  /** Gets the view ready: waits for it to load and puts away anything open over it. */
  ready: (page: Page) => Promise<void>;
  /** CSS that hides the page's chrome, so the image is the 3D view alone. */
  hide: string;
  /** The part of the 1280 × 720 view to keep, in CSS pixels; 16:9. */
  crop: { x: number; y: number; width: number };
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
    crop: { x: 0, y: 160, width: 996 },
  },
  {
    name: 'gas-petroleum',
    path: 'utilities/gas-petroleum/',
    ready: async (page) => {
      await page.waitForLoadState('networkidle');
      await page.locator('#p-close').click();
      // Let the camera settle after the panel closes.
      await page.waitForTimeout(2500);
    },
    hide: '.brand, .tools, .hint, #panel, #labels',
    crop: { x: 230, y: 152, width: 800 },
  },
];

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
    await page.goto(`${BASE}${shot.path}`);
    await shot.ready(page);
    const path = `${OUT}/${shot.name}.jpg`;
    await page.screenshot({
      path,
      type: 'jpeg',
      quality: 80,
      animations: 'disabled',
      style: `${shot.hide} { visibility: hidden !important; }`,
      clip: { ...shot.crop, height: (shot.crop.width * 9) / 16 },
    });
    console.log(`Wrote ${path}.`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
