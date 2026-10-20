/**
 * The site's icons come from Phosphor (MIT), bold weight, by way of the @phosphor-icons/core
 * package: `npm run icons` writes their shapes into src/design/icon-data.ts, so they ship in the
 * site's own code, with no icon font and nothing fetched at runtime. A unit test checks the file
 * still matches the package (src/design/icons.test.ts).
 *
 * To add an icon, give it a name here, pick its Phosphor name at https://phosphoricons.com, and
 * run `npm run icons`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

/** The site's name for each icon, and the Phosphor icon it draws. */
export const ICONS = {
  gas: 'flame',
  // A phone, for telecommunications lines; Wi-Fi would mean wireless.
  telecom: 'phone',
  transmitter: 'radio',
  stake: 'push-pin',
  access: 'plug',
  wire: 'wave-sine',
  settings: 'sliders-horizontal',
  close: 'x',
  'chevron-up': 'caret-up',
  'chevron-down': 'caret-down',
  back: 'arrow-left',
  forward: 'arrow-right',
  ticket: 'ticket',
  layers: 'stack',
  locate: 'crosshair',
  pause: 'pause',
  play: 'play',
  info: 'info',
  idea: 'lightbulb',
  rule: 'list-checks',
  list: 'list-bullets',
  // A fuel pump, for gasoline; a fuel can reads like a bin.
  fuel: 'gas-pump',
  map: 'map-trifold',
  check: 'check',
  'turn-left': 'arrow-counter-clockwise',
  'turn-right': 'arrow-clockwise',
  // The diorama's camera buttons, as on a map: zoom, and setting the view back, a compass.
  'zoom-in': 'plus',
  'zoom-out': 'minus',
  compass: 'compass',
  // The lab's guide, and its key to the colors and marks in the view.
  guide: 'book-open-text',
  key: 'swatches',
  // Labels in the view, shown or hidden: a tag, as on a part.
  labels: 'tag',
  // Read the Marks: a flag for a mark's color, and an icon for what each mark shows.
  flag: 'flag',
  dig: 'shovel',
  electric: 'lightning',
  water: 'drop',
  sewer: 'toilet',
  reclaimed: 'recycle',
  survey: 'ruler',
  again: 'arrow-counter-clockwise',
} as const;

const PACKAGE = new URL('../node_modules/@phosphor-icons/core/', import.meta.url);

/** The package's version, for the file's note and the credits. */
export function phosphorVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('package.json', PACKAGE), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

/** One icon's shape: the path data of its bold SVG, which must be a single path. */
function pathOf(name: string): string {
  const file = new URL(`assets/bold/${name}-bold.svg`, PACKAGE);
  const svg = readFileSync(file, 'utf8');
  if (!svg.includes('viewBox="0 0 256 256"')) throw new Error(`${name}: not on a 256 grid`);
  const paths = [...svg.matchAll(/<path d="([^"]+)"\s*\/>/g)];
  const shapes = svg.match(/<(path|circle|rect|line|polyline|polygon|ellipse|g)\b/g) ?? [];
  const [first] = paths;
  if (paths.length !== 1 || shapes.length !== 1 || !first?.[1]) {
    throw new Error(`${name}: expected a single path`);
  }
  return first[1];
}

/** The source of src/design/icon-data.ts, formatted as the repo formats code. */
export async function iconDataSource(): Promise<string> {
  const entries = Object.entries(ICONS)
    .map(([site, phosphor]) => `  ${JSON.stringify(site)}: ${JSON.stringify(pathOf(phosphor))},`)
    .join('\n');
  const source = [
    '/**',
    ` * The site's icons: Phosphor's bold weight (MIT), from @phosphor-icons/core ${phosphorVersion()},`,
    ' * as path data on a 256 grid, filled with the current color. Written by scripts/icon-data.ts',
    ' * (`npm run icons`): change the list there, not here.',
    ' */',
    'export const ICON_PATHS = {',
    entries,
    '} as const;',
    '',
  ].join('\n');
  const options = await resolveConfig(ICON_DATA_FILE);
  return format(source, { ...options, filepath: ICON_DATA_FILE });
}

export const ICON_DATA_FILE = 'src/design/icon-data.ts';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(ICON_DATA_FILE, await iconDataSource());
  console.log(`Wrote ${ICON_DATA_FILE}: ${String(Object.keys(ICONS).length)} icons.`);
}
