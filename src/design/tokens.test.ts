import { describe, expect, it } from 'vitest';
import { pbrNeutral } from '../kit3d/tonemap.ts';
import { APWA, LAB_APWA, type ApwaCode } from './apwa.ts';
import {
  contrast,
  hexToOklch,
  hexToRgb,
  hueDistance,
  linearRgbToOklch,
  srgbToLinear,
} from './color.ts';
import { MATERIAL_COLORS, SIGNAL_COLOR, THEMES, WORLD_COLORS, type ThemeName } from './tokens.ts';

const themes: ThemeName[] = ['light', 'dark'];
const chromatic = (Object.keys(APWA) as ApwaCode[]).filter((c) => c !== 'white');

describe('chrome contrast (WCAG 2.2 AA)', () => {
  it.each(themes)('%s: body and secondary text pass 4.5:1 on every surface', (name) => {
    const t = THEMES[name].chrome;
    for (const bg of [t.bg, t.surface, t.surface2]) {
      expect(contrast(t.ink, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(t.ink2, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.ink3, bg), `muted text on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t.accentInk, t.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themes)('%s: the focus ring passes 3:1 against every surface', (name) => {
    const t = THEMES[name].chrome;
    for (const bg of [t.bg, t.surface, t.surface2]) {
      expect(contrast(t.focus, bg)).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(themes)('%s: APWA text colors pass 4.5:1 on surfaces and their soft tints', (name) => {
    const t = THEMES[name].chrome;
    for (const code of Object.keys(APWA) as ApwaCode[]) {
      const c = APWA[code];
      for (const bg of [t.bg, t.surface, t.surface2, c.soft[name]]) {
        expect(contrast(c.ink[name], bg), `${code} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('color means utility', () => {
  it('keeps the default UI accent neutral (no hue to confuse with a mark color)', () => {
    for (const name of themes) expect(hexToOklch(THEMES[name].chrome.accent).c).toBeLessThan(0.02);
  });

  it('keeps the world muted, so the line tints and the signal are the strongest colors', () => {
    const world: [string, string][] = Object.entries(MATERIAL_COLORS);
    for (const [name, value] of Object.entries(WORLD_COLORS)) {
      // Lamps and lit windows are lights, not surfaces.
      if (name === 'windowLit' || name === 'lamp') continue;
      if (typeof value === 'string') world.push([name, value]);
      else value.forEach((hex, i) => world.push([`${name}[${String(i)}]`, hex]));
    }
    const weakestMeaning = Math.min(
      hexToOklch(SIGNAL_COLOR).c,
      ...chromatic.map((code) => hexToOklch(APWA[code].fill).c),
    );
    for (const [name, hex] of world) {
      expect(hexToOklch(hex).c, name).toBeLessThan(Math.min(0.09, weakestMeaning * 0.6));
    }
  });

  it('gives the signal its own hue, well away from every APWA color', () => {
    const signal = hexToOklch(SIGNAL_COLOR);
    expect(signal.c).toBeGreaterThan(0.1);
    for (const code of chromatic) {
      const c = hexToOklch(APWA[code].fill);
      expect(hueDistance(signal.h, c.h), code).toBeGreaterThanOrEqual(30);
    }
  });
});

describe('tone mapping keeps the color code true', () => {
  // Albedo times light, from shadowed to brightly lit.
  const exposures = [0.35, 0.7, 1, 1.6];

  it.each(LAB_APWA)('%s keeps its hue from shadow to highlight', (code) => {
    const { r, g, b } = hexToRgb(APWA[code].fill);
    const base = linearRgbToOklch({ r: srgbToLinear(r), g: srgbToLinear(g), b: srgbToLinear(b) });
    for (const k of exposures) {
      const [tr, tg, tb] = pbrNeutral([
        srgbToLinear(r) * k,
        srgbToLinear(g) * k,
        srgbToLinear(b) * k,
      ]);
      const out = linearRgbToOklch({ r: tr, g: tg, b: tb });
      expect(hueDistance(out.h, base.h), `${code} at ${k}x`).toBeLessThanOrEqual(6);
      if (k <= 1)
        expect(out.c / (base.c * Math.cbrt(k)), `${code} chroma at ${k}x`).toBeGreaterThan(0.75);
    }
  });
});
