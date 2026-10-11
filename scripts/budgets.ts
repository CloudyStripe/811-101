/**
 * Load budgets for the Frequency Lab page, measured from the production build (gzip level 9,
 * fonts as shipped). Fails when anything is over budget.
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
}
type Manifest = Record<string, ManifestChunk>;

const KB = 1024;
const BUDGETS = {
  'Initial JS': 50 * KB,
  CSS: 30 * KB,
  'Fonts (latin)': 200 * KB,
  '3D vendor': 240 * KB,
  n8ao: 85 * KB,
  'Scene code': 70 * KB,
  'First visit total': 750 * KB,
} as const;
type Item = keyof typeof BUDGETS;

const dist = resolve('dist');
const manifest = JSON.parse(
  await readFile(resolve(dist, '.vite/manifest.json'), 'utf8'),
) as Manifest;

const gzip = async (file: string) =>
  gzipSync(await readFile(resolve(dist, file)), { level: 9 }).length;
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

const entryKey = Object.keys(manifest).find(
  (k) => chunk(k).isEntry && k.endsWith('training/frequency-lab/index.html'),
);
if (!entryKey) throw new Error('No Frequency Lab entry in the build manifest');

const initial = staticClosure(entryKey);
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

const sizes: Record<Item, number> = {
  'Initial JS': 0,
  CSS: 0,
  'Fonts (latin)': 0,
  '3D vendor': 0,
  n8ao: 0,
  'Scene code': 0,
  'First visit total': 0,
};

for (const k of initial) sizes['Initial JS'] += await gzip(chunk(k).file);
for (const k of lazy) {
  const c = chunk(k);
  const size = await gzip(c.file);
  if (c.src?.includes('node_modules/n8ao/')) sizes.n8ao += size;
  else if (c.name === 'vendor-3d') sizes['3D vendor'] += size;
  else sizes['Scene code'] += size;
}
const cssFiles = new Set([...initial, ...lazy].flatMap((k) => chunk(k).css ?? []));
for (const f of cssFiles) sizes.CSS += await gzip(f);

// Browsers fetch only the subsets a page's text needs: count the latin files, not latin-ext.
const assets = await readdir(resolve(dist, 'assets'));
for (const f of assets.filter((a) => /-latin-(?!ext)[\w-]*\.woff2$/.test(a))) {
  sizes['Fonts (latin)'] += (await stat(resolve(dist, 'assets', f))).size;
}

const html = await gzip('training/frequency-lab/index.html');
sizes['First visit total'] =
  html +
  sizes['Initial JS'] +
  sizes.CSS +
  sizes['Fonts (latin)'] +
  sizes['3D vendor'] +
  sizes.n8ao +
  sizes['Scene code'];

const items = Object.keys(BUDGETS) as Item[];
const kb = (n: number) => `${(n / KB).toFixed(1)} KB`;
const rows = items.map((item) => {
  const flag = sizes[item] > BUDGETS[item] ? 'OVER' : ' ok ';
  return `${flag}  ${item.padEnd(18)} ${kb(sizes[item]).padStart(10)}  / ${kb(BUDGETS[item])}`;
});
console.log(rows.join('\n'));
if (items.some((item) => sizes[item] > BUDGETS[item])) {
  console.error('\nOver budget.');
  process.exit(1);
}
