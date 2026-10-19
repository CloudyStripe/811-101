/**
 * Makes the site's placeholders: a tiny copy of each picture its pages show first (the portal's
 * stills and the 3D pages' loader posters), written inline into src/site/placeholders.ts, so a
 * picture's place shows something like it from the first paint until the picture itself lands.
 * `npm run thumbnails` runs it once it has made the pictures; on its own,
 * `node scripts/placeholders.ts` makes them again from the pictures in public/. Beside each copy it
 * notes which version of its picture it was made from (`pictureHash`), so a test can tell when a
 * picture has changed and its copy hasn't.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { format, resolveConfig } from 'prettier';
import { SECTIONS } from '../content/portal.ts';
import { PAGES, POSTER_SHAPES, posterPath } from '../src/site/pages.ts';
import { PLACEHOLDER_WIDTH, THEME_NAMES, heroPath, previewPath } from '../src/site/stills.ts';

const OUT = 'src/site/placeholders.ts';
/**
 * How wide a picture's tiny copy is: a loader poster's, which stands in for a whole view, a little
 * wider (or, upright, the same size again), the rest at the base width.
 */
function placeholderWidth(path: string): number {
  if (path.endsWith('-wide.webp')) return PLACEHOLDER_WIDTH * 2;
  return PLACEHOLDER_WIDTH;
}

/** WebP quality for a placeholder: it's seen only for a moment, and much enlarged. */
const QUALITY = 0.5;

/** A short hash of a picture's bytes: the version of it a tiny copy was made from. */
export function pictureHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

/** Every picture that gets one, by its address under the site's base path. */
export function picturesWithPlaceholders(): string[] {
  const lessons = SECTIONS.flatMap((section) => section.lessons);
  return THEME_NAMES.flatMap((theme) => [
    heroPath(theme),
    ...lessons.map((lesson) => previewPath(lesson.image, theme)),
    ...PAGES.filter((page) => page.scene).flatMap((page) =>
      POSTER_SHAPES.map((shape) => posterPath(page, theme, shape)),
    ),
  ]).sort();
}

/**
 * A WebP as its image alone: the canvas encoder adds a colour profile that's half a tiny copy's
 * size, and these are plain sRGB, as the page is.
 */
function plainWebp(webp: Buffer): Buffer {
  for (let at = 12; at + 8 <= webp.length;) {
    const kind = webp.toString('ascii', at, at + 4);
    const size = webp.readUInt32LE(at + 4);
    if (kind === 'VP8 ' || kind === 'VP8L') {
      const chunk = webp.subarray(at, at + 8 + size + (size % 2));
      const head = Buffer.alloc(12);
      head.write('RIFF', 0, 'ascii');
      head.writeUInt32LE(4 + chunk.length, 4);
      head.write('WEBP', 8, 'ascii');
      return Buffer.concat([head, chunk]);
    }
    at += 8 + size + (size % 2);
  }
  throw new Error('No image data in a WebP');
}

export async function writePlaceholders(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const entries: [string, string][] = [];
    const made: [string, string][] = [];
    for (const path of picturesWithPlaceholders()) {
      const file = await readFile(`public/${path}`);
      made.push([path, pictureHash(file)]);
      const bytes = file.toString('base64');
      const uri = await page.evaluate(
        async ({ bytes, width, quality }) => {
          const data = Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([data], { type: 'image/webp' }));
          const height = Math.round((width * bitmap.height) / bitmap.width);
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No 2D canvas');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(bitmap, 0, 0, width, height);
          const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
          const out = new Uint8Array(await blob.arrayBuffer());
          let binary = '';
          for (const b of out) binary += String.fromCharCode(b);
          return `data:image/webp;base64,${btoa(binary)}`;
        },
        { bytes, width: placeholderWidth(path), quality: QUALITY },
      );
      const encoded = Buffer.from(uri.split(',')[1] ?? '', 'base64');
      entries.push([path, `data:image/webp;base64,${plainWebp(encoded).toString('base64')}`]);
    }
    // Apart: the portal's page shows the stills' copies, the 3D pages their posters'.
    const body = (folder: string) =>
      entries
        .filter(([path]) => path.startsWith(`${folder}/`))
        .map(([path, uri]) => `  '${path}':\n    '${uri}',`)
        .join('\n');
    const source = [
      '// Made by scripts/placeholders.ts from the pictures in public/ (npm run thumbnails): not by hand.',
      '',
      '/**',
      ' * A tiny copy of each picture the pages show first, by its address under the site’s base path,',
      ' * inline, to stand in its place until the picture lands: the portal’s stills, then the 3D',
      ' * pages’ loader posters.',
      ' */',
      'export const STILL_PLACEHOLDERS: Readonly<Record<string, string>> = {',
      body('stills'),
      '};',
      '',
      'export const POSTER_PLACEHOLDERS: Readonly<Record<string, string>> = {',
      body('posters'),
      '};',
      '',
      '/** The version of each picture its copy was made from (`pictureHash`, scripts/placeholders.ts). */',
      'export const PLACEHOLDER_SOURCES: Readonly<Record<string, string>> = {',
      made.map(([path, hash]) => `  '${path}': '${hash}',`).join('\n'),
      '};',
      '',
    ].join('\n');
    // As the project's formatter has it, so the check on the code's format passes.
    const options = (await resolveConfig(OUT)) ?? {};
    await writeFile(OUT, await format(source, { ...options, filepath: OUT }));
    console.log(`Wrote ${OUT} (${String(entries.length)} placeholders).`);
  } finally {
    await browser.close();
  }
}

if (import.meta.main) await writePlaceholders();
