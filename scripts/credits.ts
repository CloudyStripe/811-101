/**
 * The open-source credits: every package whose code, fonts or shapes the site ships, with its
 * license, written to public/credits.txt (`npm run credits`), which the footer links to. A unit
 * test checks the file still matches the installed packages (src/site/credits.test.ts).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * What the site ships from each package. A package whose own license file disagrees with its
 * package.json names the license that file grants.
 */
export const CREDITED: readonly { name: string; ships: string; license?: string }[] = [
  { name: 'three', ships: '3D rendering' },
  { name: 'postprocessing', ships: 'Bloom, tone mapping and antialiasing' },
  // Its package.json says ISC, but the license file it ships is CC0 1.0.
  { name: 'n8ao', ships: 'Ambient occlusion', license: 'CC0-1.0' },
  { name: 'camera-controls', ships: "Turning, tilting, zooming and panning the diorama's camera" },
  { name: 'preact', ships: 'The interface' },
  { name: '@phosphor-icons/core', ships: 'Icons (Phosphor, bold weight)' },
  { name: '@fontsource-variable/archivo', ships: 'The Archivo typeface' },
  { name: '@fontsource/atkinson-hyperlegible', ships: 'The Atkinson Hyperlegible typeface' },
  { name: '@fontsource/ibm-plex-mono', ships: 'The IBM Plex Mono typeface' },
];

const ROOT = new URL('../', import.meta.url);

interface Manifest {
  version: string;
  license?: string;
  homepage?: string;
  repository?: string | { url: string };
}

function manifest(name: string): Manifest {
  return JSON.parse(
    readFileSync(new URL(`node_modules/${name}/package.json`, ROOT), 'utf8'),
  ) as Manifest;
}

/** The package's license text, from its LICENSE file. */
function licenseText(name: string): string {
  const dir = new URL(`node_modules/${name}/`, ROOT);
  const file = readdirSync(dir).find((f) => /^licen[cs]e(\.(md|txt))?$/i.test(f));
  if (!file) throw new Error(`${name}: no license file`);
  return readFileSync(new URL(file, dir), 'utf8').replace(/\r\n/g, '\n').trim();
}

function homepage(m: Manifest): string {
  if (m.homepage) return m.homepage.replace(/#readme$/, '');
  const repo = typeof m.repository === 'string' ? m.repository : m.repository?.url;
  const url = (repo ?? '').replace(/^git\+/, '').replace(/\.git$/, '');
  // A bare "owner/name" is GitHub's shorthand.
  return /^[\w.-]+\/[\w.-]+$/.test(url) ? `https://github.com/${url}` : url;
}

/** The text of public/credits.txt. */
export function creditsText(): string {
  const rule = '-'.repeat(72);
  const sections = CREDITED.map(({ name, ships, license }) => {
    const m = manifest(name);
    return [
      rule,
      `${name} ${m.version}`,
      ships,
      `License: ${license ?? m.license ?? 'see below'}`,
      homepage(m),
      '',
      licenseText(name),
      '',
    ].join('\n');
  });
  return [
    '811 101: open-source credits',
    '',
    'This site is built with the open-source software and typefaces below, each under its own',
    'license, reproduced in full.',
    '',
    ...sections,
  ].join('\n');
}

export const CREDITS_FILE = 'public/credits.txt';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(CREDITS_FILE, creditsText());
  console.log(`Wrote ${CREDITS_FILE}: ${String(CREDITED.length)} packages.`);
}
