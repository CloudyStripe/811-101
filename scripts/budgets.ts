/**
 * Load budgets for each page, measured from the production build (gzip level 9; fonts and
 * images as shipped). The pages and their budgets come from src/site/pages.ts. Fails when
 * anything is over budget.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { BASE_PATH } from '../config/brand.ts';
import { SECTIONS } from '../content/portal.ts';
import {
  PAGES,
  posterPath,
  type PageBudgets,
  type PageId,
  type PageInfo,
} from '../src/site/pages.ts';
import { THEME_NAMES, heroPath, previewPath } from '../src/site/stills.ts';

interface ManifestChunk {
  file: string;
  name?: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
  assets?: string[];
}
type Manifest = Record<string, ManifestChunk>;

const KB = 1024;
const dist = resolve('dist');
const manifest = JSON.parse(
  await readFile(resolve(dist, '.vite/manifest.json'), 'utf8'),
) as Manifest;

const gzip = async (file: string) =>
  gzipSync(await readFile(resolve(dist, file)), { level: 9 }).length;
const size = async (file: string) => (await stat(resolve(dist, file))).size;
const chunk = (key: string): ManifestChunk => {
  const c = manifest[key];
  if (!c) throw new Error(`Missing manifest entry ${key}`);
  return c;
};

/** Adds up a measure (gzip or size) over files. */
async function total(files: Iterable<string>, measure: (file: string) => Promise<number>) {
  let sum = 0;
  for (const f of files) sum += await measure(f);
  return sum;
}

/** A chunk plus everything it imports statically. */
function staticClosure(key: string, into = new Set<string>()): Set<string> {
  if (into.has(key)) return into;
  into.add(key);
  for (const k of chunk(key).imports ?? []) staticClosure(k, into);
  return into;
}

/** Chunks a page loads later, on demand: everything its dynamic imports pull in. */
function lazyClosure(initial: Set<string>): Set<string> {
  const lazy = new Set<string>();
  const queue = [...initial].flatMap((k) => chunk(k).dynamicImports ?? []);
  while (queue.length) {
    const key = queue.pop();
    if (key === undefined || initial.has(key) || lazy.has(key)) continue;
    for (const k of staticClosure(key)) {
      if (!initial.has(k) && !lazy.has(k)) {
        lazy.add(k);
        queue.push(...(chunk(k).dynamicImports ?? []));
      }
    }
  }
  return lazy;
}

/**
 * Latin font files a page's CSS points to. Browsers fetch only the subsets a page's text needs,
 * so latin-ext and other subsets aren't counted.
 */
async function latinFonts(cssFiles: Iterable<string>): Promise<Set<string>> {
  const fonts = new Set<string>();
  const assets = new Set(await readdir(resolve(dist, 'assets')));
  for (const css of cssFiles) {
    const text = await readFile(resolve(dist, css), 'utf8');
    // URLs carry the site's base path and may be quoted; the file name is what matters.
    for (const [, name] of text.matchAll(
      /url\(\s*["']?(?:[^)"']*\/)?([\w.-]+-latin-(?!ext)[\w-]*\.woff2)["']?\s*\)/g,
    )) {
      if (name && assets.has(name)) fonts.add(`assets/${name}`);
    }
  }
  // Every page uses the site's fonts; finding none means this script has stopped reading them.
  if (fonts.size === 0) throw new Error('Found no latin fonts in a page’s CSS');
  return fonts;
}

/**
 * Files a built page points to with a given tag and attribute, as paths in dist: the built HTML
 * is the truth about what a page starts loading.
 */
function referenced(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].flatMap(([, url]) =>
    url ? [url.replace(BASE_PATH, '').replace(/^\//, '')] : [],
  );
}

/** The manifest's key for a built file. */
function keyOf(file: string): string {
  const key = Object.keys(manifest).find((k) => manifest[k]?.file === file);
  if (!key) throw new Error(`No manifest entry for ${file}`);
  return key;
}

/** What every page loads: its HTML, the JS it starts with, and its CSS and fonts. */
async function measure(html: string) {
  const text = await readFile(resolve(dist, html), 'utf8');
  const scripts = referenced(text, /<script[^>]*\ssrc="([^"]+)"/g);
  if (scripts.length === 0) throw new Error(`${html} loads no script`);
  const initial = new Set<string>();
  for (const file of scripts) staticClosure(keyOf(file), initial);
  const lazy = lazyClosure(initial);
  const jsFiles = [...initial].map((k) => chunk(k).file);
  const cssFiles = new Set([
    ...referenced(text, /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g),
    ...[...initial, ...lazy].flatMap((k) => chunk(k).css ?? []),
  ]);
  return {
    initial,
    lazy,
    html: await gzip(html),
    js: await total(jsFiles, gzip),
    css: await total(cssFiles, gzip),
    fonts: await total(await latinFonts(cssFiles), size),
  };
}

interface Row {
  item: string;
  bytes: number;
  budget: number;
}

/** Short names for the report. */
const NAMES: Record<PageId, string> = {
  portal: 'Portal',
  'frequency-lab': 'Lab',
  'gas-petroleum': 'Diorama',
  'not-found': '404',
};

/**
 * The portal's stills (dist/stills/), as one visit loads them: the hero in the reader's theme (on
 * a phone, none), and each lesson's preview in the reader's theme. Each set counts its largest.
 */
async function stillsBytes(): Promise<number> {
  const largest = async (paths: string[]) =>
    Math.max(
      ...(await Promise.all(paths.map(async (path) => (await stat(resolve(dist, path))).size))),
    );
  let bytes = await largest(THEME_NAMES.map((theme) => heroPath(theme)));
  for (const lesson of SECTIONS.flatMap((section) => section.lessons)) {
    bytes += await largest(THEME_NAMES.map((theme) => previewPath(lesson.image, theme)));
  }
  return bytes;
}

/** One page's rows: what it loads up front, its 3D code and poster if it has a view, in total. */
async function pageRows(page: PageInfo, budgets: PageBudgets): Promise<Row[]> {
  const name = NAMES[page.id];
  const m = await measure(page.html);
  const imageFiles = new Set(
    [...m.initial]
      .flatMap((k) => chunk(k).assets ?? [])
      .filter((f) => /\.(jpe?g|png|webp|avif)$/.test(f)),
  );
  // Bundled images, and on the portal, the stills its hero and previews show.
  const images = (await total(imageFiles, size)) + (page.id === 'portal' ? await stillsBytes() : 0);
  let vendor = 0;
  let ao = 0;
  let scene = 0;
  for (const k of m.lazy) {
    const c = chunk(k);
    const bytes = await gzip(c.file);
    if (c.src?.includes('node_modules/n8ao/')) ao += bytes;
    else if (c.name === 'vendor-3d') vendor += bytes;
    else scene += bytes;
  }
  // The loader shows one poster, the reader's theme's; count the larger.
  const poster = page.scene
    ? Math.max(
        ...(await Promise.all(
          (['light', 'dark'] as const).map(
            async (theme) => (await stat(resolve(dist, posterPath(page, theme)))).size,
          ),
        )),
      )
    : 0;
  const rows: Row[] = [
    { item: `${name}: JS`, bytes: m.js, budget: budgets.js * KB },
    { item: `${name}: CSS`, bytes: m.css, budget: budgets.css * KB },
    { item: `${name}: fonts`, bytes: m.fonts, budget: budgets.fonts * KB },
  ];
  if (budgets.images !== undefined) {
    rows.push({ item: `${name}: images`, bytes: images, budget: budgets.images * KB });
  }
  if (page.scene) {
    rows.push(
      { item: `${name}: 3D vendor`, bytes: vendor, budget: (budgets.vendor3d ?? 0) * KB },
      { item: `${name}: n8ao`, bytes: ao, budget: (budgets.ao ?? 0) * KB },
      { item: `${name}: scene code`, bytes: scene, budget: (budgets.scene ?? 0) * KB },
      { item: `${name}: poster`, bytes: poster, budget: (budgets.poster ?? 0) * KB },
    );
  }
  rows.push({
    item: `${name}: first visit`,
    bytes: m.html + m.js + m.css + m.fonts + images + vendor + ao + scene + poster,
    budget: budgets.firstVisit * KB,
  });
  return rows;
}

const rows: Row[] = [];
for (const page of PAGES) {
  if (!page.budgets) throw new Error(`${page.id} has no budgets`);
  rows.push(...(await pageRows(page, page.budgets)));
}

const kb = (n: number) => `${(n / KB).toFixed(1)} KB`;
console.log(
  rows
    .map((r) => {
      const flag = r.bytes > r.budget ? 'OVER' : ' ok ';
      return `${flag}  ${r.item.padEnd(22)} ${kb(r.bytes).padStart(10)}  / ${kb(r.budget)}`;
    })
    .join('\n'),
);
if (rows.some((r) => r.bytes > r.budget)) {
  console.error('\nOver budget.');
  process.exit(1);
}
