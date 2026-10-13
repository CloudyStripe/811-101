/**
 * The site's mark: a locate probe above the ground, over a line buried below it, drawn in
 * section. An original glyph in ink only, used in the header, the favicons and the share cards.
 * It's not 811 or Common Ground Alliance artwork, and stands for nothing but this site.
 */

/** The geometry, on a 32-unit grid. */
export const MARK = {
  viewBox: '0 0 32 32',
  /** The rounded tile the mark sits on. */
  tile: { x: 1, y: 1, size: 30, radius: 8 },
  /** The ground line, a stratum below it, and the probe above the ground. */
  lines: 'M6.5 14h19M6.5 24.5h19M16 5v5.5',
  /** The buried line, seen end-on. */
  pipe: { cx: 16, cy: 19.25, r: 3.3 },
  stroke: 2.6,
} as const;

interface MarkColors {
  /** The tile: ink by day, chalk by night. */
  tile: string;
  /** The lines and pipe, cut out of the tile: the page's color. */
  cut: string;
}

/** The mark's shapes, colored by attribute values (a color, or `currentColor`). */
function shapes({ tile, cut }: MarkColors): string {
  const t = MARK.tile;
  const p = MARK.pipe;
  return [
    `<rect x="${String(t.x)}" y="${String(t.y)}" width="${String(t.size)}" height="${String(t.size)}" rx="${String(t.radius)}" fill="${tile}"/>`,
    `<path d="${MARK.lines}" fill="none" stroke="${cut}" stroke-width="${String(MARK.stroke)}" stroke-linecap="round"/>`,
    `<circle cx="${String(p.cx)}" cy="${String(p.cy)}" r="${String(p.r)}" fill="${tile}" stroke="${cut}" stroke-width="${String(MARK.stroke)}"/>`,
  ].join('');
}

/** The mark as an inline SVG for a page, colored by CSS: `.mark-tile` and `.mark-cut`. */
export function markInline(className = 'mark'): string {
  const t = MARK.tile;
  const p = MARK.pipe;
  return [
    `<svg class="${className}" viewBox="${MARK.viewBox}" aria-hidden="true" focusable="false">`,
    `<rect class="mark-tile" x="${String(t.x)}" y="${String(t.y)}" width="${String(t.size)}" height="${String(t.size)}" rx="${String(t.radius)}"/>`,
    `<path class="mark-cut" d="${MARK.lines}" fill="none" stroke-width="${String(MARK.stroke)}" stroke-linecap="round"/>`,
    `<circle class="mark-tile mark-cut" cx="${String(p.cx)}" cy="${String(p.cy)}" r="${String(p.r)}" stroke-width="${String(MARK.stroke)}"/>`,
    '</svg>',
  ].join('');
}

/** A standalone SVG file of the mark in fixed colors, such as a favicon. */
export function markFile(colors: MarkColors, size = 32): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="${MARK.viewBox}">${shapes(colors)}</svg>`;
}

/**
 * The favicon: ink on light browser chrome, chalk on dark, chosen by the browser's own color
 * scheme from inside the file.
 */
export function markFavicon(light: MarkColors, dark: MarkColors): string {
  const t = MARK.tile;
  const p = MARK.pipe;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK.viewBox}">`,
    '<style>',
    `.t{fill:${light.tile}}.c{stroke:${light.cut}}`,
    `@media (prefers-color-scheme:dark){.t{fill:${dark.tile}}.c{stroke:${dark.cut}}}`,
    '</style>',
    `<rect class="t" x="${String(t.x)}" y="${String(t.y)}" width="${String(t.size)}" height="${String(t.size)}" rx="${String(t.radius)}"/>`,
    `<path class="c" d="${MARK.lines}" fill="none" stroke-width="${String(MARK.stroke)}" stroke-linecap="round"/>`,
    `<circle class="t c" cx="${String(p.cx)}" cy="${String(p.cy)}" r="${String(p.r)}" stroke-width="${String(MARK.stroke)}"/>`,
    '</svg>',
  ].join('');
}
