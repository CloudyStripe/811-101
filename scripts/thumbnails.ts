/**
 * Captures the site's images from its own 3D views: `npm run thumbnails`. Run it again when a
 * lesson's look changes. It serves the site with Vite's dev server and opens each view with its
 * chrome hidden, then writes:
 * - the portal's stills, day and night (public/stills/): each lesson's preview, cropped to the
 *   scene, and the hero, wide and square;
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
import { THEMES, TYPE } from '../src/design/tokens.ts';
import { PAGES, pageById, posterPath, type PageInfo } from '../src/site/pages.ts';
import { SHARE_SIZE } from '../src/site/shell.ts';
import {
  HERO_SIZES,
  PREVIEW_SIZE,
  THEME_NAMES,
  heroPath,
  previewPath,
} from '../src/site/stills.ts';
import { TILE_COLORS, WORDMARK_HTML, archivoFace, wordmarkCss } from './wordmark.ts';

const PORT = 5199;
const BASE = `http://localhost:${String(PORT)}/811-101/`;
const VIEWPORT = { width: 1280, height: 720 };
/** WebP quality for the portal's stills: sharp enough at their size, light to load. */
const STILL_QUALITY = 0.7;
/** Posters are shown blurred, so a small one does. */
const POSTER = { width: 480, height: 270, quality: 0.6 };
/**
 * How long a screenshot of a 3D view may take. In software WebGL the first frame after a view is
 * ready can take a quarter of a minute to reach the screen, as its shaders finish compiling.
 */
const SHOT_TIMEOUT = 120_000;

/** CSS that hides the lab's chrome, so an image is the 3D view alone. */
const LAB_CHROME = '.site-header, [data-chrome], .labels, .scene-loader';

interface Shot {
  /** The lesson whose preview it makes (see previewPath). */
  name: Lesson['image'];
  path: string;
  /** Gets the view ready: waits for it to load and puts away anything open over it. */
  ready: (page: Page) => Promise<void>;
  /** CSS that hides the page's chrome, so the image is the 3D view alone. */
  hide: string;
  /** The part of the 1280 × 720 view to keep, in CSS pixels; 16:9. */
  crop: { x: number; y: number; width: number };
}

/** Opens the lab in capture mode; its guide and key start closed, so the view has its whole room. */
async function labReady(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.sceneReady === 'true');
}

/** The diorama in capture mode, its guide closed, so the overview has the whole width. */
async function dioramaReady(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.sceneReady === 'true');
  const close = page.getByRole('button', { name: 'Close the guide' });
  if (await close.isVisible()) await close.click();
}

const SHOTS: Shot[] = [
  {
    name: 'frequency-lab',
    path: 'training/frequency-lab/?setup=steel&f=33000&tier=high&capture',
    ready: labReady,
    hide: LAB_CHROME,
    // Close on the hookup and the signal setting off along the main, apart from the hero.
    crop: { x: 40, y: 185, width: 600 },
  },
  {
    name: 'gas-petroleum',
    path: 'utilities/gas-petroleum/?tier=high&capture',
    ready: dioramaReady,
    hide: LAB_CHROME,
    crop: { x: 120, y: 120, width: 1040 },
  },
];

/**
 * The phone's square hero, cut from the wide capture (1200 × 900) around the block's near end: the
 * hookup, the trench and the signal setting off along the main.
 */
const HERO_SQUARE_CROP = { x: 20, y: 150, width: 600, height: 600 };

/** The portal's hero: the lab's block in its town, the signal along the gas main. */
const HERO = {
  path: 'training/frequency-lab/?setup=steel&f=8000&tier=high&capture',
  ready: labReady,
  hide: LAB_CHROME,
};

/** What each 3D page shows in its poster and share preview. */
const STILLS: Partial<
  Record<PageInfo['id'], { path: string; ready: (page: Page) => Promise<void>; hide: string }>
> = {
  'frequency-lab': {
    path: 'training/frequency-lab/?setup=steel&f=512&tier=high&capture',
    ready: labReady,
    hide: LAB_CHROME,
  },
  'gas-petroleum': {
    path: 'utilities/gas-petroleum/?tier=high&capture',
    ready: dioramaReady,
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

/** Re-encodes an image in the browser: a part of it (or all), scaled to a size, as WebP or JPEG. */
function encode(
  page: Page,
  image: Buffer,
  size: { width: number; height: number },
  type: 'image/webp' | 'image/jpeg',
  quality: number,
  from?: { x: number; y: number; width: number; height: number },
): Promise<Buffer> {
  return page
    .evaluate(
      async ({ base64, size, type, quality, from }) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(size.width, size.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D canvas');
        ctx.imageSmoothingQuality = 'high';
        const part = from ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
        ctx.drawImage(
          bitmap,
          part.x,
          part.y,
          part.width,
          part.height,
          0,
          0,
          size.width,
          size.height,
        );
        const blob = await canvas.convertToBlob({ type, quality });
        const out = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (const b of out) binary += String.fromCharCode(b);
        return btoa(binary);
      },
      { base64: image.toString('base64'), size, type, quality, from },
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
      timeout: SHOT_TIMEOUT,
    });
    if (errors.length) throw new Error(`${view.path}: ${errors.join(' | ')}`);
    if ((await spreadOf(page, png, 'image/png')) < 8) throw new Error(`${view.path}: blank`);
    return png;
  });
}

/** The site's own fonts, embedded, so share previews are set in them like the pages are. */
async function fontFaces(): Promise<string> {
  const body = (
    await readFile(
      'node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2',
    )
  ).toString('base64');
  return [
    await archivoFace(),
    `@font-face { font-family: "Atkinson Hyperlegible"; src: url(data:font/woff2;base64,${body}) format("woff2"); font-weight: 400; }`,
  ].join('\n');
}

/** The share preview: the page's still, its name and the wordmark tile over a soft fade. */
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
    ${wordmarkCss(108, TILE_COLORS.light)}
    h1 { margin: 0; font: 900 72px/1.02 ${TYPE.display}; font-stretch: 112%; letter-spacing: -0.01em; }
    p { margin: 10px 0 0; font: 400 30px/1.3 ${TYPE.body}; color: ${t.ink2}; }
  </style></head><body><div class="card"><div class="fade"></div><div class="text">${WORDMARK_HTML}<div><h1>${name}</h1><p>${line}</p></div></div></div></body></html>`;
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
  // The portal's lesson previews, in each theme.
  for (const shot of SHOTS) {
    for (const scheme of THEME_NAMES) {
      // Render at the scale that makes the crop come out as wide as the preview.
      const png = await withPage(
        browser,
        { ...VIEWPORT, scale: PREVIEW_SIZE.width / shot.crop.width, scheme },
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
          const image = await page.screenshot({
            animations: 'disabled',
            style: `${shot.hide} { visibility: hidden !important; }`,
            clip,
            timeout: SHOT_TIMEOUT,
          });
          if (errors.length) throw new Error(`${shot.name}: ${errors.join(' | ')}`);
          if ((await spreadOf(page, image, 'image/png')) < 8) {
            throw new Error(`${shot.name}: the image is blank`);
          }
          return image;
        },
      );
      const webp = await withPage(browser, { width: 200, height: 200, scale: 1, scheme }, (tab) =>
        encode(tab, png, PREVIEW_SIZE, 'image/webp', STILL_QUALITY),
      );
      const path = `public/${previewPath(shot.name, scheme)}`;
      await writeFile(path, webp);
      console.log(`Wrote ${path} (${(webp.length / 1024).toFixed(1)} KB).`);
    }
  }

  // The portal's hero, in each theme: wide beside its words, and square, cut from the same
  // capture, under them on phones.
  for (const scheme of THEME_NAMES) {
    const png = await still(browser, HERO, HERO_SIZES.wide, scheme);
    const shapes = [
      ['wide', undefined],
      ['square', HERO_SQUARE_CROP],
    ] as const;
    for (const [shape, crop] of shapes) {
      const webp = await withPage(browser, { width: 200, height: 200, scale: 1, scheme }, (tab) =>
        encode(tab, png, HERO_SIZES[shape], 'image/webp', STILL_QUALITY, crop),
      );
      const path = `public/${heroPath(scheme, shape)}`;
      await writeFile(path, webp);
      console.log(`Wrote ${path} (${(webp.length / 1024).toFixed(1)} KB).`);
    }
  }

  // Posters and share previews, for every 3D page built on the site's shell.
  for (const page of PAGES.filter((p) => p.scene)) {
    const view = STILLS[page.id];
    if (!view) throw new Error(`No still for ${page.id}`);
    for (const scheme of THEME_NAMES) {
      const png = await still(browser, view, VIEWPORT, scheme);
      const webp = await withPage(browser, { width: 200, height: 200, scale: 1, scheme }, (tab) =>
        encode(tab, png, POSTER, 'image/webp', POSTER.quality),
      );
      const path = `public/${posterPath(page, scheme)}`;
      await writeFile(path, webp);
      console.log(`Wrote ${path} (${(webp.length / 1024).toFixed(1)} KB).`);
    }
  }

  // Share previews: each 3D page with its own view, and the home page with the lab's.
  const shareStill = async (id: PageInfo['id']) => {
    const view = STILLS[id];
    if (!view) throw new Error(`No still for ${id}`);
    return still(browser, view, SHARE_SIZE, 'light');
  };
  const labStill = await shareStill('frequency-lab');
  const cards: [PageInfo, Buffer][] = [
    [pageById('portal'), labStill],
    [pageById('frequency-lab'), labStill],
    [pageById('gas-petroleum'), await shareStill('gas-petroleum')],
  ];
  const fonts = await fontFaces();
  for (const [page, image] of cards) {
    const jpeg = await withPage(
      browser,
      { ...SHARE_SIZE, scale: 1, scheme: 'light' },
      async (tab) => {
        await tab.setContent(shareCard(page, image, fonts));
        await tab.evaluate(() => document.fonts.ready.then(() => undefined));
        return tab.screenshot({ type: 'jpeg', quality: 82 });
      },
    );
    const path = `public/share/${page.share.image}`;
    await writeFile(path, jpeg);
    console.log(`Wrote ${path} (${(jpeg.length / 1024).toFixed(1)} KB).`);
  }
  // Each card came out as a real image, not an empty page.
  for (const [page] of cards) {
    const bytes = await readFile(`public/share/${page.share.image}`);
    if (bytes.length < 10_000) throw new Error(`${page.share.image} looks empty`);
  }
} finally {
  await browser.close();
  await server.close();
}
