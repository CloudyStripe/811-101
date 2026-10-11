/**
 * Load budgets for each page, measured from the production build (gzip level 9; fonts and
 * images as shipped). Fails when anything is over budget.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

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

function entryFor(html: string): string {
  const key = Object.keys(manifest).find((k) => chunk(k).isEntry && k === html);
  if (!key) throw new Error(`No entry for ${html} in the build manifest`);
  return key;
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

interface Row {
  item: string;
  bytes: number;
  budget: number;
}

async function labRows(): Promise<Row[]> {
  const initial = staticClosure(entryFor('training/frequency-lab/index.html'));
  const lazy = lazyClosure(initial);
  let js = 0;
  let vendor = 0;
  let ao = 0;
  let scene = 0;
  for (const k of initial) js += await gzip(chunk(k).file);
  for (const k of lazy) {
    const c = chunk(k);
    const bytes = await gzip(c.file);
    if (c.src?.includes('node_modules/n8ao/')) ao += bytes;
    else if (c.name === 'vendor-3d') vendor += bytes;
    else scene += bytes;
  }
  const cssFiles = new Set([...initial, ...lazy].flatMap((k) => chunk(k).css ?? []));
  let css = 0;
  for (const f of cssFiles) css += await gzip(f);
  let fonts = 0;
  for (const f of await latinFonts(cssFiles)) fonts += await size(f);
  const html = await gzip('training/frequency-lab/index.html');
  return [
    { item: 'Lab: initial JS', bytes: js, budget: 50 * KB },
    { item: 'Lab: CSS', bytes: css, budget: 30 * KB },
    { item: 'Lab: fonts', bytes: fonts, budget: 200 * KB },
    { item: 'Lab: 3D vendor', bytes: vendor, budget: 240 * KB },
    { item: 'Lab: n8ao', bytes: ao, budget: 85 * KB },
    { item: 'Lab: scene code', bytes: scene, budget: 70 * KB },
    {
      item: 'Lab: first visit',
      bytes: html + js + css + fonts + vendor + ao + scene,
      budget: 750 * KB,
    },
  ];
}

async function portalRows(): Promise<Row[]> {
  const initial = staticClosure(entryFor('index.html'));
  let js = 0;
  for (const k of initial) js += await gzip(chunk(k).file);
  const cssFiles = new Set([...initial].flatMap((k) => chunk(k).css ?? []));
  let css = 0;
  for (const f of cssFiles) css += await gzip(f);
  let fonts = 0;
  for (const f of await latinFonts(cssFiles)) fonts += await size(f);
  let images = 0;
  for (const f of new Set([...initial].flatMap((k) => chunk(k).assets ?? []))) {
    if (/\.(jpe?g|png|webp|avif)$/.test(f)) images += await size(f);
  }
  const html = await gzip('index.html');
  return [
    { item: 'Portal: JS', bytes: js, budget: 30 * KB },
    { item: 'Portal: CSS', bytes: css, budget: 15 * KB },
    { item: 'Portal: fonts', bytes: fonts, budget: 150 * KB },
    { item: 'Portal: images', bytes: images, budget: 150 * KB },
    { item: 'Portal: first visit', bytes: html + js + css + fonts + images, budget: 350 * KB },
  ];
}

const rows = [...(await portalRows()), ...(await labRows())];
const kb = (n: number) => `${(n / KB).toFixed(1)} KB`;
console.log(
  rows
    .map((r) => {
      const flag = r.bytes > r.budget ? 'OVER' : ' ok ';
      return `${flag}  ${r.item.padEnd(20)} ${kb(r.bytes).padStart(10)}  / ${kb(r.budget)}`;
    })
    .join('\n'),
);
if (rows.some((r) => r.bytes > r.budget)) {
  console.error('\nOver budget.');
  process.exit(1);
}
