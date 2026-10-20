/**
 * Captures the site's images from its own 3D views: `npm run thumbnails`. Run it again when a
 * lesson's look changes. It serves the site with Vite's dev server and opens each view with its
 * chrome hidden, then writes:
 * - the portal's stills, day and night (public/stills/): each lesson's preview, cropped to the
 *   scene, and the hero, the whole diorama in its sky;
 * - each 3D page's loader posters, day and night: WebPs shown lightly blurred while the view loads
 *   (public/posters/);
 * - share previews: 1200 × 630 JPEGs with the mark and the page's name (public/share/);
 * - the placeholders: a tiny copy of each still and poster, inline in the pages
 *   (src/site/placeholders.ts, by scripts/placeholders.ts).
 * It stops without saving anything wrong: on a page error, a crop outside the 3D view, or an
 * image that comes out blank.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Browser, type Page } from '@playwright/test';
import { createServer } from 'vite';
import { BRAND } from '../config/brand.ts';
import type { Lesson } from '../content/portal.ts';
import { THEMES, TYPE } from '../src/design/tokens.ts';
import {
  PAGES,
  POSTER_SHAPES,
  pageById,
  posterPath,
  type PageInfo,
  type PosterShape,
} from '../src/site/pages.ts';
import { SHARE_SIZE } from '../src/site/shell.ts';
import { HERO_SIZE, PREVIEW_SIZE, THEME_NAMES, heroPath, previewPath } from '../src/site/stills.ts';
import { writePlaceholders } from './placeholders.ts';
import { TILE_COLORS, WORDMARK_HTML, archivoFace, wordmarkCss } from './wordmark.ts';

/**
 * `--only=<page id>` makes only that page's pictures: its preview, posters and share preview (the
 * portal's: its hero and share preview). The placeholders are made again from every picture.
 */
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
if (ONLY && !PAGES.some((p) => p.id === ONLY)) throw new Error(`No page ${ONLY}`);
const wanted = (id: PageInfo['id']) => !ONLY || ONLY === id;

const PORT = 5199;
const BASE = `http://localhost:${String(PORT)}/811-101/`;
const VIEWPORT = { width: 1280, height: 720 };
/** WebP quality for the portal's stills: sharp enough at their size, light to load. */
const STILL_QUALITY = 0.7;
/**
 * Posters stand in for the view while it loads, only lightly blurred, so each is the view itself
 * as it first draws, cut to its own box, on a wide screen and a tall one, sharp enough at its size.
 */
const POSTER_SCREENS: Record<
  PosterShape,
  { width: number; height: number; scale: number; mobile: boolean; out: number }
> = {
  wide: { width: 1440, height: 900, scale: 1, mobile: false, out: 960 },
  tall: { width: 390, height: 844, scale: 2, mobile: true, out: 540 },
};
const POSTER_QUALITY = 0.62;
/**
 * How long a screenshot of a 3D view may take. In software WebGL the first frame after a view is
 * ready can take a quarter of a minute to reach the screen, as its shaders finish compiling.
 */
const SHOT_TIMEOUT = 120_000;

/** CSS that hides a 3D page's chrome, so an image is the 3D view alone. */
const LAB_CHROME = '.site-header, [data-chrome], .labels, .scene-loader';
/** The diorama's, with the hint that goes once the view is moved. */
const DIORAMA_CHROME = `${LAB_CHROME}, .gp-hint`;

interface Shot {
  /** The lesson whose preview it makes (see previewPath). */
  name: Lesson['image'];
  path: string;
  /** Gets the view ready: waits for it to load and puts away anything open over it. */
  ready: (page: Page) => Promise<void>;
  /** CSS that hides the page's chrome, so the image is the 3D view alone. */
  hide: string;
  /** The part of the 1280 × 720 view to keep, in CSS pixels, as wide as the preview's shape. */
  crop: { x: number; y: number; width: number };
}

/** Waits for a 3D view to load, as it starts. */
async function viewReady(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.sceneReady === 'true');
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

/** The diorama, moved by its own keys: each move a cut, with reduced motion. */
function dioramaMoved(keys: readonly string[]): (page: Page) => Promise<void> {
  return async (page) => {
    await dioramaReady(page);
    const view = page.locator('canvas').first();
    await view.focus();
    for (const key of keys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
    }
    // Off the view again, or its focus ring would frame the still.
    await view.blur();
    // Give the view a frame or two to draw where it was moved to.
    await page.waitForTimeout(1500);
  };
}

const SHOTS: Shot[] = [
  {
    name: 'read-the-marks',
    // A round under way, the gas line open: the marks, and what's under one.
    path: 'basics/read-the-marks/?seed=1&show=gas&tier=high&capture',
    ready: viewReady,
    hide: LAB_CHROME,
    // The front lawn, the outline and the open gas line, the sidewalk and the grass strip.
    crop: { x: 60, y: 150, width: 760 },
  },
  {
    name: 'frequency-lab',
    path: 'training/frequency-lab/?setup=steel&f=33000&tier=high&capture',
    ready: labReady,
    hide: LAB_CHROME,
    // Close on the hookup and the signal setting off along the main, the street edge over them.
    crop: { x: 40, y: 178, width: 600 },
  },
  {
    name: 'gas-petroleum',
    path: 'utilities/gas-petroleum/?stop=distillation&tier=high&capture',
    ready: dioramaMoved(['+', '+']),
    hide: DIORAMA_CHROME,
    // Close on the refinery, its wells and the gas station, apart from the hero's whole model.
    crop: { x: 140, y: 120, width: 1040 },
  },
];

/**
 * The portal's hero, the whole diorama in its sky: the overview two steps farther out, by its own
 * key, at 1600 × 900 one and a half times over (2400 × 1350 pixels), cut to the model and a
 * margin of sky either side, top to bottom.
 */
const HERO = {
  path: 'utilities/gas-petroleum/?tier=high&capture',
  ready: dioramaMoved(['-', '-']),
  hide: DIORAMA_CHROME,
  viewport: { width: 1600, height: 900 },
  scale: 1.5,
  crop: { x: 342, y: 0, width: 1642, height: 1350 },
} as const;

/**
 * What each 3D page shows in its poster: its view as it starts, so the diorama's guide is open
 * where there's room for it.
 */
const POSTER_VIEWS: Partial<
  Record<PageInfo['id'], { path: string; ready: (page: Page) => Promise<void>; hide: string }>
> = {
  // The yard as a round starts: the white outline asked about, glowing.
  'read-the-marks': {
    path: 'basics/read-the-marks/?seed=1&tier=high&capture',
    ready: viewReady,
    hide: LAB_CHROME,
  },
  'frequency-lab': {
    path: 'training/frequency-lab/?setup=steel&f=512&tier=high&capture',
    ready: viewReady,
    hide: LAB_CHROME,
  },
  // Where the view's arrival starts, from farther out, so the view takes over from the poster.
  'gas-petroleum': {
    path: 'utilities/gas-petroleum/?tier=high&capture&arrival',
    ready: viewReady,
    hide: DIORAMA_CHROME,
  },
};

/** What each 3D page shows in its share preview. */
const STILLS: Partial<
  Record<PageInfo['id'], { path: string; ready: (page: Page) => Promise<void>; hide: string }>
> = {
  'read-the-marks': {
    path: 'basics/read-the-marks/?seed=1&show=gas&tier=high&capture',
    ready: viewReady,
    hide: LAB_CHROME,
  },
  'frequency-lab': {
    path: 'training/frequency-lab/?setup=steel&f=512&tier=high&capture',
    ready: labReady,
    hide: LAB_CHROME,
  },
  'gas-petroleum': {
    path: 'utilities/gas-petroleum/?tier=high&capture',
    ready: dioramaReady,
    hide: DIORAMA_CHROME,
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
  options: {
    width: number;
    height: number;
    scale: number;
    scheme: 'light' | 'dark';
    mobile?: boolean;
  },
  fn: (page: Page, errors: string[]) => Promise<T>,
): Promise<T> {
  const page = await browser.newPage({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: options.scale,
    isMobile: options.mobile ?? false,
    hasTouch: options.mobile ?? false,
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
  // The posters may not exist yet (or not in each shape): this script is what makes them.
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

/** A 3D view with its chrome hidden, as a PNG at the given size (times `scale`) and theme. */
async function still(
  browser: Browser,
  view: { path: string; ready: (page: Page) => Promise<void>; hide: string },
  size: { width: number; height: number },
  scheme: 'light' | 'dark',
  scale = 1,
): Promise<Buffer> {
  return withPage(browser, { ...size, scale, scheme }, async (page, errors) => {
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
  for (const shot of SHOTS.filter((s) => wanted(s.name))) {
    for (const scheme of THEME_NAMES) {
      // Render at the scale that makes the crop come out as wide as the preview.
      const png = await withPage(
        browser,
        { ...VIEWPORT, scale: PREVIEW_SIZE.width / shot.crop.width, scheme },
        async (page, errors) => {
          await page.goto(`${BASE}${shot.path}`);
          await shot.ready(page);
          const clip = {
            ...shot.crop,
            height: (shot.crop.width * PREVIEW_SIZE.height) / PREVIEW_SIZE.width,
          };
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

  // The portal's hero, in each theme.
  for (const scheme of wanted('portal') ? THEME_NAMES : []) {
    const png = await still(browser, HERO, HERO.viewport, scheme, HERO.scale);
    const webp = await withPage(browser, { width: 200, height: 200, scale: 1, scheme }, (tab) =>
      encode(tab, png, HERO_SIZE, 'image/webp', STILL_QUALITY, HERO.crop),
    );
    const path = `public/${heroPath(scheme)}`;
    await writeFile(path, webp);
    console.log(`Wrote ${path} (${(webp.length / 1024).toFixed(1)} KB).`);
  }

  // Posters, for every 3D page built on the site's shell: its view alone, cut to its own box.
  await mkdir('public/posters', { recursive: true });
  for (const page of PAGES.filter((p) => p.scene && wanted(p.id))) {
    const view = POSTER_VIEWS[page.id];
    if (!view) throw new Error(`No poster view for ${page.id}`);
    for (const shape of POSTER_SHAPES) {
      const screen = POSTER_SCREENS[shape];
      for (const scheme of THEME_NAMES) {
        const { png, box } = await withPage(browser, { ...screen, scheme }, async (tab, errors) => {
          await tab.goto(`${BASE}${view.path}`);
          await view.ready(tab);
          const found = await tab.locator('canvas').first().boundingBox();
          if (!found) throw new Error(`${page.id}: no 3D view`);
          const clip = {
            x: Math.round(found.x),
            y: Math.round(found.y),
            width: Math.round(found.width),
            height: Math.round(found.height),
          };
          const image = await tab.screenshot({
            animations: 'disabled',
            style: `${view.hide} { visibility: hidden !important; }`,
            clip,
            timeout: SHOT_TIMEOUT,
          });
          if (errors.length) throw new Error(`${page.id}: ${errors.join(' | ')}`);
          if ((await spreadOf(tab, image, 'image/png')) < 8) throw new Error(`${page.id}: blank`);
          return { png: image, box: clip };
        });
        const size = {
          width: screen.out,
          height: Math.round((screen.out * box.height) / box.width),
        };
        const webp = await withPage(browser, { width: 200, height: 200, scale: 1, scheme }, (tab) =>
          encode(tab, png, size, 'image/webp', POSTER_QUALITY),
        );
        const path = `public/${posterPath(page, scheme, shape)}`;
        await writeFile(path, webp);
        console.log(`Wrote ${path} (${(webp.length / 1024).toFixed(1)} KB).`);
      }
    }
  }

  // Share previews: each 3D page with its own view, and the home page with the lab's.
  const shareStill = async (id: PageInfo['id']) => {
    const view = STILLS[id];
    if (!view) throw new Error(`No still for ${id}`);
    return still(browser, view, SHARE_SIZE, 'light');
  };
  // The home page's card shows the lab's view.
  const sources: [PageInfo['id'], PageInfo['id']][] = [
    ['portal', 'frequency-lab'],
    ['read-the-marks', 'read-the-marks'],
    ['frequency-lab', 'frequency-lab'],
    ['gas-petroleum', 'gas-petroleum'],
  ];
  const stills = new Map<PageInfo['id'], Buffer>();
  const cards: [PageInfo, Buffer][] = [];
  for (const [id, from] of sources.filter(([id]) => wanted(id))) {
    const image = stills.get(from) ?? (await shareStill(from));
    stills.set(from, image);
    cards.push([pageById(id), image]);
  }
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

// The tiny copies of what was just made.
await writePlaceholders();
