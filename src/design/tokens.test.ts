import { describe, expect, it } from 'vitest';
import { BLOOM_THRESHOLD } from '../kit3d/post.ts';
import { inversePbrNeutral, pbrNeutral } from '../kit3d/tonemap.ts';
import { LAMP_GLOW, WINDOW_GLOW } from '../kit3d/world.ts';
import { APWA, LAB_APWA, type ApwaCode } from './apwa.ts';
import {
  contrast,
  hexToOklch,
  hexToRgb,
  hueDistance,
  linearRgbToOklch,
  luminance,
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

describe('the scene sits on the page', () => {
  it.each(themes)('%s: the paper under the section is the page itself', (name) => {
    expect(THEMES[name].scene.paper).toBe(THEMES[name].chrome.bg);
  });

  it.each(themes)('%s: backdrops reach the screen as authored, through tone mapping', (name) => {
    const s = THEMES[name].scene;
    for (const hex of [s.paper, s.skyHorizon, s.skyZenith]) {
      const { r, g, b } = hexToRgb(hex);
      const target = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)] as const;
      const shown = pbrNeutral(inversePbrNeutral(target));
      shown.forEach((channel, i) => {
        expect(Math.abs(channel - (target[i] ?? 0)), `${hex} channel ${String(i)}`).toBeLessThan(
          1e-3,
        );
      });
    }
  });
});

describe('the lit world stays muted on screen', () => {
  // Every surface color as the screen shows it: lit by the theme's key light, from shadow to full
  // light, then tone mapped. Next to any code color of a similar hue, lit the same way, it must
  // stay well below that color's strength, so soil never reads as orange or grass as green paint.
  const surfaces: [string, string][] = Object.entries(MATERIAL_COLORS);
  for (const [name, value] of Object.entries(WORLD_COLORS)) {
    // Lamps and lit windows are lights, not surfaces.
    if (name === 'windowLit' || name === 'lamp') continue;
    if (typeof value === 'string') surfaces.push([name, value]);
    else value.forEach((hex, i) => surfaces.push([`${name}[${String(i)}]`, hex]));
  }
  const shown = (hex: string, light: readonly number[], k: number) => {
    const { r, g, b } = hexToRgb(hex);
    const [tr, tg, tb] = pbrNeutral([
      srgbToLinear(r) * (light[0] ?? 0) * k,
      srgbToLinear(g) * (light[1] ?? 0) * k,
      srgbToLinear(b) * (light[2] ?? 0) * k,
    ]);
    return linearRgbToOklch({ r: tr, g: tg, b: tb });
  };

  it.each(themes)('%s: no surface reads as a color of the code', (name) => {
    const key = hexToRgb(THEMES[name].scene.key.color);
    const light = [srgbToLinear(key.r), srgbToLinear(key.g), srgbToLinear(key.b)];
    for (const [surface, hex] of surfaces) {
      for (const k of [0.35, 0.7, 1]) {
        const world = shown(hex, light, k);
        for (const code of chromatic) {
          const meaning = shown(APWA[code].fill, light, k);
          if (hueDistance(world.h, meaning.h) > 35) continue;
          expect(world.c, `${surface} beside ${code} at ${String(k)}x`).toBeLessThanOrEqual(
            meaning.c * 0.6,
          );
        }
      }
    }
  });
});

describe('only emitters bloom', () => {
  // Bloom picks out what's brighter than its threshold. An upper bound for the light on a surface:
  // facing the key light square on, with the sky fill and the whole environment as bright as its
  // brightest panel. Lamps and lit windows add their glow to that light, and still stay under it.
  const surfaces = [
    ...Object.values(MATERIAL_COLORS),
    ...Object.entries(WORLD_COLORS).flatMap(([name, value]) =>
      name === 'windowLit' || name === 'lamp' ? [] : typeof value === 'string' ? [value] : value,
    ),
  ];
  const lightest = Math.max(...surfaces.map((hex) => luminance(hex)));
  const light = (name: ThemeName) => {
    const s = THEMES[name].scene;
    const key = (luminance(s.key.color) * s.key.intensity * s.exposure) / Math.PI;
    const fill =
      (Math.max(luminance(s.hemisphere.sky), luminance(s.hemisphere.ground)) *
        s.hemisphere.intensity *
        s.exposure) /
      Math.PI;
    // The environment's softbox is the key color, 2.2 times over (lighting.ts).
    const environment = 2.2 * luminance(s.key.color) * s.envIntensity * s.exposure;
    return key + fill + environment;
  };

  it.each(themes)('%s: no lit surface reaches the bloom threshold', (name) => {
    expect(lightest * light(name)).toBeLessThan(BLOOM_THRESHOLD);
  });

  it.each(themes)('%s: lamps and lit windows glow, lit as well, but stay under it', (name) => {
    const { lamps } = THEMES[name].scene;
    const lamp = LAMP_GLOW * lamps * luminance(WORLD_COLORS.lamp);
    const pane = WINDOW_GLOW * lamps * luminance(WORLD_COLORS.windowLit);
    expect(lamp + luminance(WORLD_COLORS.lampHousing) * light(name)).toBeLessThan(BLOOM_THRESHOLD);
    expect(pane + luminance(WORLD_COLORS.window) * light(name)).toBeLessThan(BLOOM_THRESHOLD);
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
