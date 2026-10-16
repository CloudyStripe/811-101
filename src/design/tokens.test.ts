import { describe, expect, it } from 'vitest';
import { FLAME_GLOW } from '../pages/gas-petroleum/scene/kit.ts';
import { BACKDROP_STOPS, backdropAt } from '../kit3d/backdrop.ts';
import { GLINT_CAP, tint } from '../kit3d/materials.ts';
import { BLOOM_THRESHOLD } from '../kit3d/post.ts';
import { inversePbrNeutral, pbrNeutral } from '../kit3d/tonemap.ts';
import { LAMP_GLOW, WINDOW_GLOW } from '../kit3d/world.ts';
import { APWA, DIORAMA_APWA, LAB_APWA, type ApwaCode } from './apwa.ts';
import {
  contrast,
  hexToOklch,
  hexToRgb,
  hueDistance,
  linearRgbToOklch,
  luminance,
  srgbToLinear,
} from './color.ts';
import {
  DEVICE,
  DIORAMA_COLORS,
  FACILITY_TINT_STRENGTH,
  MATERIAL_COLORS,
  MOTION,
  SIGNAL_COLOR,
  THEMES,
  WORLD_COLORS,
  easeInOut,
  labSceneTokens,
  type SceneTokens,
  type ThemeName,
} from './tokens.ts';

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

  it('device screens are readable: light figures on a dark screen, in both themes', () => {
    expect(contrast(DEVICE.lcdInk, DEVICE.lcd)).toBeGreaterThanOrEqual(7);
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

describe('the interface stays out of the way', () => {
  it('keeps the default UI accent neutral (no hue to confuse with a mark color)', () => {
    for (const name of themes) expect(hexToOklch(THEMES[name].chrome.accent).c).toBeLessThan(0.02);
  });

  it.each(themes)('%s: is white or a cool near-black, never warm', (name) => {
    const t = THEMES[name].chrome;
    for (const [key, hex] of Object.entries({
      bg: t.bg,
      surface: t.surface,
      surface2: t.surface2,
      ink: t.ink,
      line: t.line,
    })) {
      const c = hexToOklch(hex);
      expect(c.c, key).toBeLessThan(0.03);
      // Any tint it has is a cool blue-gray, never cream or beige.
      if (c.c > 0.004) expect(hueDistance(c.h, 255), `${key} hue`).toBeLessThan(30);
    }
  });
});

describe('a sunlit, colorful scene', () => {
  const day = THEMES.light.scene;
  const night = THEMES.dark.scene;

  it('has a blue sky by day, never beige: deep overhead, pale toward the horizon', () => {
    for (const hex of [day.skyZenith, day.skyHorizon, day.skyBelow]) {
      const c = hexToOklch(hex);
      expect(hueDistance(c.h, 250), hex).toBeLessThan(20);
      expect(c.c, hex).toBeGreaterThan(0.02);
    }
    expect(hexToOklch(day.skyZenith).c).toBeGreaterThan(0.1);
    expect(hexToOklch(day.skyHorizon).l).toBeGreaterThan(hexToOklch(day.skyZenith).l + 0.15);
  });

  it('has a deep blue sky at night', () => {
    for (const hex of [night.skyZenith, night.skyHorizon, night.skyBelow]) {
      const c = hexToOklch(hex);
      expect(hueDistance(c.h, 262), hex).toBeLessThan(20);
      expect(c.c, hex).toBeGreaterThan(0.05);
      expect(c.l, hex).toBeLessThan(0.55);
    }
  });

  it('has a low, warm sun by day, for long shadows', () => {
    const sun = hexToOklch(day.key.color);
    expect(hueDistance(sun.h, 70)).toBeLessThan(25);
    expect(day.key.elevation).toBeLessThanOrEqual(35);
    // The lab's sun swings toward its cut face, and stays as low.
    const lab = labSceneTokens('light').key;
    expect(Math.abs(lab.azimuth)).toBeLessThan(Math.abs(day.key.azimuth));
    expect(lab.elevation).toBe(day.key.elevation);
  });

  it('has green grass, never olive', () => {
    for (const hex of [
      MATERIAL_COLORS.grass,
      MATERIAL_COLORS.grassLight,
      MATERIAL_COLORS.grassPatch,
    ]) {
      const c = hexToOklch(hex);
      expect(c.h, hex).toBeGreaterThan(125);
      expect(c.h, hex).toBeLessThan(150);
      expect(c.c, hex).toBeGreaterThan(0.13);
    }
  });

  it('has roofs in at least three colors, told apart by hue or value', () => {
    const roofs = WORLD_COLORS.roofs.map(hexToOklch);
    expect(roofs.length).toBeGreaterThanOrEqual(3);
    roofs.forEach((a, i) => {
      roofs.slice(i + 1).forEach((b) => {
        expect(hueDistance(a.h, b.h) > 30 || Math.abs(a.l - b.l) > 0.12).toBe(true);
      });
    });
  });

  it('has white tanks: neutral, and the lightest thing on the ground', () => {
    const tank = hexToOklch(DIORAMA_COLORS.tank);
    expect(tank.l).toBeGreaterThan(0.95);
    expect(tank.c).toBeLessThan(0.01);
  });

  it('is colorful, not muted: grass, trees, roofs, soil and sea all carry real color', () => {
    for (const hex of [
      MATERIAL_COLORS.grass,
      WORLD_COLORS.foliage,
      WORLD_COLORS.roofs[0],
      MATERIAL_COLORS.subsoil,
      DIORAMA_COLORS.overburden,
      DIORAMA_COLORS.sea,
    ]) {
      expect(hexToOklch(hex).c, hex).toBeGreaterThan(0.08);
    }
  });
});

describe('color means utility', () => {
  it('draws every buried line close to its full APWA color', () => {
    for (const code of LAB_APWA) {
      const fill = hexToOklch(APWA[code].fill);
      for (const base of [
        MATERIAL_COLORS.coatedSteel,
        MATERIAL_COLORS.casing,
        MATERIAL_COLORS.graphite,
      ]) {
        const line = hexToOklch(tint(base, APWA[code].fill, FACILITY_TINT_STRENGTH));
        expect(hueDistance(line.h, fill.h), `${code} on ${base}`).toBeLessThan(8);
        expect(line.c, `${code} on ${base}`).toBeGreaterThan(fill.c * 0.85);
      }
    }
  });

  it('keeps the fuel paths the only APWA yellow in the diorama', () => {
    const yellow = hexToOklch(APWA.yellow.fill);
    const scenery: [string, string][] = [
      ...Object.entries(DIORAMA_COLORS),
      ...Object.entries(MATERIAL_COLORS),
      ...Object.entries(WORLD_COLORS).flatMap(([name, value]) =>
        typeof value === 'string'
          ? [[name, value] as [string, string]]
          : value.map((hex, i): [string, string] => [`${name}[${String(i)}]`, hex]),
      ),
    ];
    for (const [name, hex] of scenery) {
      // Fire and lamplight are lights, not surfaces.
      if (['flame', 'flameCore', 'furnaceGlow', 'windowLit', 'lamp'].includes(name)) continue;
      const c = hexToOklch(hex);
      if (hueDistance(c.h, yellow.h) > 30) continue;
      expect(c.c, name).toBeLessThan(yellow.c * 0.6);
    }
  });

  it("never paints water underground in drinking water's blue, nor produced water in sewer's green", () => {
    const blue = hexToOklch(APWA.blue.fill);
    const green = hexToOklch(APWA.green.fill);
    /** A color reads as a mark's hue only with real chroma and a hue near the mark's. */
    const readsAs = (hex: string, mark: { h: number }) => {
      const c = hexToOklch(hex);
      return c.c > 0.04 && hueDistance(c.h, mark.h) < 40;
    };
    for (const name of ['aquifer', 'waterZone', 'producedWater'] as const) {
      expect(readsAs(DIORAMA_COLORS[name], blue), `${name} as blue`).toBe(false);
    }
    for (const name of ['waterZone', 'producedWater'] as const) {
      expect(readsAs(DIORAMA_COLORS[name], green), `${name} as green`).toBe(false);
    }
  });

  it('paints the open sea a natural blue, lighter and greener than APWA blue', () => {
    const sea = hexToOklch(DIORAMA_COLORS.sea);
    const blue = hexToOklch(APWA.blue.fill);
    expect(hueDistance(sea.h, blue.h)).toBeGreaterThanOrEqual(12);
    expect(sea.l).toBeGreaterThan(blue.l + 0.05);
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

/** A color as the screen shows it, lit to `k` times its albedo by a light of the given color. */
function shown(hex: string, light: readonly number[], k: number) {
  const { r, g, b } = hexToRgb(hex);
  const [tr, tg, tb] = pbrNeutral([
    srgbToLinear(r) * (light[0] ?? 0) * k,
    srgbToLinear(g) * (light[1] ?? 0) * k,
    srgbToLinear(b) * (light[2] ?? 0) * k,
  ]);
  return linearRgbToOklch({ r: tr, g: tg, b: tb });
}

describe('the ground stays ground', () => {
  // Where the lines run (the cut faces, and what fills the rock), every surface as the screen
  // shows it, lit by the key light from shadow to full light and tone mapped. Next to any code
  // color its lesson uses, of a similar hue and lit the same way, it must stay well below that
  // color's strength, or be far darker or lighter, so clay never reads as the telecom cable's
  // orange, nor sand as the gas main's yellow. (A brown is a dark orange-yellow: it reads as earth
  // by its depth.)
  const underground: [string, string, readonly ApwaCode[]][] = [
    ...(['topsoil', 'subsoil', 'clay', 'gravel', 'rock', 'backfill'] as const).map(
      (name): [string, string, readonly ApwaCode[]] => [name, MATERIAL_COLORS[name], LAB_APWA],
    ),
    ...(
      [
        'soil',
        'aquifer',
        'overburden',
        'capRock',
        'shale',
        'sourceRock',
        'basement',
        'gasZone',
        'oilZone',
        'waterZone',
        'oil',
        'gas',
        'producedWater',
        'fuel',
      ] as const
    ).map((name): [string, string, readonly ApwaCode[]] => [
      `diorama ${name}`,
      DIORAMA_COLORS[name],
      DIORAMA_APWA,
    ]),
  ];

  it.each(themes)('%s: nothing underground reads as a color of the code', (name) => {
    const key = hexToRgb(THEMES[name].scene.key.color);
    const light = [srgbToLinear(key.r), srgbToLinear(key.g), srgbToLinear(key.b)];
    for (const [surface, hex, codes] of underground) {
      for (const k of [0.35, 0.7, 1]) {
        const ground = shown(hex, light, k);
        for (const code of codes) {
          const meaning = shown(APWA[code].fill, light, k);
          if (hueDistance(ground.h, meaning.h) > 35) continue;
          const weaker = ground.c <= meaning.c * 0.6;
          const apart = Math.abs(ground.l - meaning.l) >= 0.2;
          expect(weaker || apart, `${surface} beside ${code} at ${String(k)}x`).toBe(true);
        }
      }
    }
  });
});

describe('the sky behind the model', () => {
  it.each(themes)('%s: reaches the screen as authored, through tone mapping', (name) => {
    const s = THEMES[name].scene;
    const rows = Array.from({ length: 21 }, (_, i) => backdropAt(s, i / 20));
    for (const [r, g, b] of rows) {
      const target = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)] as const;
      const back = pbrNeutral(inversePbrNeutral(target));
      back.forEach((channel, i) => {
        expect(Math.abs(channel - (target[i] ?? 0))).toBeLessThan(1e-6);
      });
    }
  });

  it.each(themes)('%s: runs from the zenith through the horizon to the band below', (name) => {
    const s = THEMES[name].scene;
    const at = (t: number) => {
      const [r, g, b] = backdropAt(s, t);
      return linearRgbToOklch({ r: srgbToLinear(r), g: srgbToLinear(g), b: srgbToLinear(b) });
    };
    expect(at(BACKDROP_STOPS.zenith).l).toBeCloseTo(hexToOklch(s.skyZenith).l, 3);
    expect(at(BACKDROP_STOPS.horizon).l).toBeCloseTo(hexToOklch(s.skyHorizon).l, 3);
    expect(at(BACKDROP_STOPS.below).l).toBeCloseTo(hexToOklch(s.skyBelow).l, 3);
  });
});

/**
 * How brightly a surface facing up is lit, as a multiple of its albedo, before tone mapping: the
 * key light, the sky fill, and the environment (its sky gradient and the soft panel on the sun's
 * side), as three's physical lights sum them (lighting.ts). `inShadow` leaves out the key light.
 */
function lightOnTop(s: SceneTokens, inShadow = false): number {
  const sin = (deg: number) => Math.sin((deg * Math.PI) / 180);
  const key = inShadow
    ? 0
    : (luminance(s.key.color) * s.key.intensity * sin(s.key.elevation)) / Math.PI;
  const hemisphere = (luminance(s.hemisphere.sky) * s.hemisphere.intensity) / Math.PI;
  // The environment's sky, from the horizon up, averaged as a surface facing up sees it.
  let sky = 0;
  let weight = 0;
  for (let i = 0; i < 90; i++) {
    const y = Math.sin(((i + 0.5) / 90) * (Math.PI / 2));
    const w = y * Math.sqrt(1 - y * y);
    const t = y ** 0.6;
    sky += (luminance(s.skyHorizon) * (1 - t) + luminance(s.skyZenith) * t) * w;
    weight += w;
  }
  // The soft panel: 40 by 18 units, 40 away, at least 35 degrees up (lighting.ts).
  const panel =
    (s.softbox *
      luminance(s.key.color) *
      ((40 * 18) / 40 ** 2) *
      sin(Math.max(s.key.elevation, 35))) /
    Math.PI;
  const environment = (sky / weight + panel) * s.envIntensity;
  return (key + hemisphere + environment) * s.exposure;
}

describe('light and shadow', () => {
  it.each(themes)('%s: sunlit ground is at least two and a half times its shade', (name) => {
    const s = THEMES[name].scene;
    expect(lightOnTop(s) / lightOnTop(s, true)).toBeGreaterThanOrEqual(2.5);
  });
});

describe('only emitters bloom', () => {
  const surfaces = [
    ...Object.values(MATERIAL_COLORS),
    ...Object.values(DIORAMA_COLORS),
    ...Object.entries(WORLD_COLORS).flatMap(([name, value]) =>
      name === 'windowLit' || name === 'lamp' ? [] : typeof value === 'string' ? [value] : value,
    ),
  ];
  const lightest = Math.max(...surfaces.map((hex) => luminance(hex)));

  it('caps glints well under the bloom threshold', () => {
    expect(GLINT_CAP).toBeLessThan(BLOOM_THRESHOLD * 0.95);
  });

  it.each(themes)('%s: the lightest surface in full sun stays under the cap', (name) => {
    // So the cap only ever trims glints; plain lit surfaces keep their shading.
    expect(lightest * lightOnTop(THEMES[name].scene) * 1.4).toBeLessThan(GLINT_CAP);
  });

  it.each(themes)('%s: lamps and lit windows glow, lit as well, but stay under it', (name) => {
    const s = THEMES[name].scene;
    const lit = lightOnTop(s) * 1.4;
    const lamp = LAMP_GLOW * s.lamps * luminance(WORLD_COLORS.lamp);
    const pane = WINDOW_GLOW * s.lamps * luminance(WORLD_COLORS.windowLit);
    expect(lamp + luminance(WORLD_COLORS.lampHousing) * lit).toBeLessThan(BLOOM_THRESHOLD);
    expect(pane + luminance(WORLD_COLORS.window) * lit).toBeLessThan(BLOOM_THRESHOLD);
  });

  it('lets fire bloom', () => {
    expect(FLAME_GLOW * luminance(DIORAMA_COLORS.flame)).toBeGreaterThan(BLOOM_THRESHOLD);
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

describe('motion', () => {
  /** A CSS cubic-bezier's progress at time t, solved for t along the curve's x. */
  function bezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
    const at = (a: number, b: number, u: number) =>
      3 * a * u * (1 - u) ** 2 + 3 * b * u ** 2 * (1 - u) + u ** 3;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  }

  it("the scene's easing is the same curve as the CSS token", () => {
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = (
      /cubic-bezier\(([^)]+)\)/.exec(MOTION.easeInOut)?.[1] ?? ''
    )
      .split(',')
      .map(Number);
    for (let t = 0; t <= 1; t += 0.05) {
      expect(easeInOut(t)).toBeCloseTo(bezier(x1, y1, x2, y2, t), 6);
    }
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
  });
});
