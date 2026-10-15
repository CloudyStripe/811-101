/**
 * Captures the site's images from its own 3D views: `npm run thumbnails`. Run it again when a
 * lesson's look changes. It serves the site with Vite's dev server and opens each view with its
 * chrome hidden, then writes:
 * - the portal's lesson images: 960 × 540 JPEGs, cropped to the scene (src/pages/portal/images/);
 * - each 3D page's loader posters, day and night: small WebPs, shown blurred (public/posters/);
 * - share previews: 1200 × 630 JPEGs with the mark and the page's name (public/share/).
 * It stops without saving anything wrong: on a page error, a crop outside the 3D view, or an
 * image that comes out blank.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, type Browser, type Page } from '@playwright/test';
import { createServer } from 'vite';
import { BRAND } from '../config/brand.ts';
import type { Lesson } from '../content/portal.ts';
import { markInline } from '../src/design/mark.ts';
import { THEMES, TYPE } from '../src/design/tokens.ts';
import { PAGES, pageById, posterPath, type PageInfo } from '../src/site/pages.ts';
import { SHARE_SIZE } from '../src/site/shell.ts';

const PORT = 5199;
const BASE = `http://localhost:${String(PORT)}/811-101/`;
const OUT = 'src/pages/portal/images';
const VIEWPORT = { width: 1280, height: 720 };
/** Output width: sharp on the portal's cards, light to load. */
const WIDTH = 960;
/** Posters are shown blurred, so a small one does. */
const POSTER = { width: 480, height: 270, quality: 0.6 };

/** CSS that hides the lab's chrome, so an image is the 3D view alone. */
const LAB_CHROME = '.site-header, [data-chrome], .labels, .scene-loader';

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

/** Opens the lab in capture mode and closes its guide, so the 3D view has the whole width. */
async function labReady(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.sceneReady === 'true');
  await page.getByRole('button', { name: 'Close the lab guide' }).click();
}

const SHOTS: Shot[] = [
  {
    name: 'frequency-lab',
    path: 'training/frequency-lab/?setup=steel&f=33000&tier=high&capture',
    ready: labReady,
    hide: LAB_CHROME,
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

/** What each 3D page shows in its poster and share preview. */
const STILLS: Partial<
  Record<PageInfo['id'], { path: string; ready: (page: Page) => Promise<void>; hide: string }>
> = {
  'frequency-lab': {
    path: 'training/frequency-lab/?setup=steel&f=512&tier=high&capture',
    ready: labReady,
    hide: LAB_CHROME,
  },
};

/** Spread of brightness in an image; a blank capture is close to 0. */
function spreadOf(page: Page, image: Buffer, type: string): Promise<number> {
  return page.evaluate(
    async ({ base64, type }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type }));
      const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
      if (!ctx) return 0;
      ctx.drawImage(bitmap, 0, 0);
      const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let i = 0; i + 2 < data.length; i += 16) {
        const y =
          0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
        sum += y;
        sumSq += y * y;
        n += 1;
      }
      const mean = sum / n;
      return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
    },
    { base64: image.toString('base64'), type },
  );
}

/** Re-encodes an image in the browser: scaled to a size, as WebP or JPEG. */
function encode(
  page: Page,
  image: Buffer,
  size: { width: number; height: number },
  type: 'image/webp' | 'image/jpeg',
  quality: number,
): Promise<Buffer> {
  return page
    .evaluate(
      async ({ base64, size, type, quality }) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(size.width, size.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D canvas');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, size.width, size.height);
        const blob = await canvas.convertToBlob({ type, quality });
        const out = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (const b of out) binary += String.fromCharCode(b);
        return btoa(binary);
      },
      { base64: image.toString('base64'), size, type, quality },
    )
    .then((b64) => Buffer.from(b64, 'base64'));
}

/** Opens a page in a fresh tab, failing on any page error, and runs `fn` with it. */
async function withPage<T>(
  browser: Browser,
  options: { width: number; height: number; scale: number; scheme: 'light' | 'dark' },
  fn: (page: Page, errors: string[]) => Promise<T>,
): Promise<T> {
  const page = await browser.newPage({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: options.scale,
    colorScheme: options.scheme,
    reducedMotion: 'reduce',
  });
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  // Missing files are caught by their address below, so the console's note of them is skipped.
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) {
      errors.push(msg.text());
    }
  });
  // The posters may not exist yet: this script is what makes them.
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('/posters/')) {
      errors.push(`${String(res.status())} ${res.url()}`);
    }
  });
  try {
    return await fn(page, errors);
  } finally {
    await page.close();
  }
}

/** A 3D view with its chrome hidden, as a PNG at the given size and theme. */
async function still(
  browser: Browser,
  view: { path: string; ready: (page: Page) => Promise<void>; hide: string },
  size: { width: number; height: number },
  scheme: 'light' | 'dark',
): Promise<Buffer> {
  return withPage(browser, { ...size, scale: 1, scheme }, async (page, errors) => {
    await page.goto(`${BASE}${view.path}`);
    await view.ready(page);
    const png = await page.screenshot({
      animations: 'disabled',
      style: `${view.hide} { visibility: hidden !important; }`,
    });
    if (errors.length) throw new Error(`${view.path}: ${errors.join(' | ')}`);
    if ((await spreadOf(page, png, 'image/png')) < 8) throw new Error(`${view.path}: blank`);
    return png;
  });
}

/** The site's own fonts, embedded, so share previews are set in them like the pages are. */
async function fontFaces(): Promise<string> {
  const face = async (family: string, file: string, weight: string, stretch = '100%') => {
    const data = (await readFile(file)).toString('base64');
    return `@font-face { font-family: "${family}"; src: url(data:font/woff2;base64,${data}) format("woff2"); font-weight: ${weight}; font-stretch: ${stretch}; }`;
  };
  return (
    await Promise.all([
      face(
        'Archivo Variable',
        'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2',
        '100 900',
        '62% 125%',
      ),
      face(
        'Atkinson Hyperlegible',
        'node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2',
        '400',
      ),
    ])
  ).join('\n');
}

/** The share preview: the page's still, its name and the site's mark over a soft fade. */
function shareCard(page: PageInfo, background: Buffer, fonts: string): string {
  const t = THEMES.light.chrome;
  const name = page.heading ?? BRAND.name;
  const line = page.heading ? BRAND.name : BRAND.tagline;
  return `<!doctype html><html><head><style>
    ${fonts}
    body { margin: 0; width: ${String(SHARE_SIZE.width)}px; height: ${String(SHARE_SIZE.height)}px; overflow: hidden; }
    .card { position: relative; width: 100%; height: 100%; background: ${t.bg} url(data:image/png;base64,${background.toString('base64')}) center / cover; }
    .fade { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 38%, ${t.bg}e6 72%, ${t.bg} 100%); }
    .text { position: absolute; left: 64px; right: 64px; bottom: 56px; display: flex; align-items: center; gap: 28px; color: ${t.ink}; }
    .mark { width: 96px; height: 96px; flex: none; }
    .mark-tile { fill: ${t.ink}; } .mark-cut { stroke: ${t.bg}; }
    h1 { margin: 0; font: 800 72px/1.02 ${TYPE.display}; font-stretch: 116%; letter-spacing: -0.02em; }
    p { margin: 10px 0 0; font: 400 30px/1.3 ${TYPE.body}; color: ${t.ink2}; }
  </style></head><body><div class="card"><div class="fade"></div><div class="text">${markInline('mark')}<div><h1>${name}</h1><p>${line}</p></div></div></div></body></html>`;
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
  // The portal's lesson images.
  for (const shot of SHOTS) {
    // Render at the scale that makes the crop come out WIDTH pixels wide.
    await withPage(
      browser,
      { ...VIEWPORT, scale: WIDTH / shot.crop.width, scheme: 'light' },
      async (page, errors) => {
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
        if ((await spreadOf(page, jpeg, 'image/jpeg')) < 8) {
          throw new Error(`${shot.name}: the image is blank`);
        }
        const path = `${OUT}/${shot.name}.jpg`;
        await writeFile(path, jpeg);
        console.log(`Wrote ${path}.`);
      },
    );
  }

  // Posters and share previews, for every 3D page built on the site's shell.
  for (const page of PAGES.filter((p) => p.built && p.scene)) {
    const view = STILLS[page.id];
    if (!view) throw new Error(`No still for ${page.id}`);
    for (const scheme of ['light', 'dark'] as const) {
      const png = await still(browser, view, VIEWPORT, scheme);
      const webp = await withPage(browser, { width: 200, height: 200, scale: 1, scheme }, (tab) =>
        encode(tab, png, POSTER, 'image/webp', POSTER.quality),
      );
      const path = `public/${posterPath(page, scheme)}`;
      await writeFile(path, webp);
      console.log(`Wrote ${path} (${(webp.length / 1024).toFixed(1)} KB).`);
    }
  }

  // Share previews: each page with one of its own, and the home page with the lab's view.
  const labView = STILLS['frequency-lab'];
  if (!labView) throw new Error('No still for the lab');
  const labStill = await still(browser, labView, SHARE_SIZE, 'light');
  const fonts = await fontFaces();
  for (const page of [pageById('portal'), pageById('frequency-lab')]) {
    const jpeg = await withPage(
      browser,
      { ...SHARE_SIZE, scale: 1, scheme: 'light' },
      async (tab) => {
        await tab.setContent(shareCard(page, labStill, fonts));
        await tab.evaluate(() => document.fonts.ready.then(() => undefined));
        return tab.screenshot({ type: 'jpeg', quality: 82 });
      },
    );
    const path = `public/share/${page.share.image}`;
    await writeFile(path, jpeg);
    console.log(`Wrote ${path} (${(jpeg.length / 1024).toFixed(1)} KB).`);
  }
  // Each card came out as a real image, not an empty page.
  for (const page of [pageById('portal'), pageById('frequency-lab')]) {
    const bytes = await readFile(`public/share/${page.share.image}`);
    if (bytes.length < 10_000) throw new Error(`${page.share.image} looks empty`);
  }
} finally {
  await browser.close();
  await server.close();
}
