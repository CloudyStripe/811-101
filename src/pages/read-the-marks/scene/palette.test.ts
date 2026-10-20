import { describe, expect, it } from 'vitest';
import { APWA, MARKS_APWA } from '../../../design/apwa.ts';
import { hexToRgb, hueDistance, linearRgbToOklch, srgbToLinear } from '../../../design/color.ts';
import { MATERIAL_COLORS, THEMES, WORLD_COLORS, type ThemeName } from '../../../design/tokens.ts';
import { pbrNeutral } from '../../../kit3d/tonemap.ts';
import { MARK_LOOK, WINDOW_LIT, YARD_COLORS } from './palette.ts';

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

const themes: ThemeName[] = ['light', 'dark'];

/** Everything in the yard that isn't a mark: what it's built of and what grows there. */
const notMarks: [string, string][] = [
  ...(Object.entries(YARD_COLORS) as [string, string][]).filter(
    // The hem is part of a flag; lit windows show only at night, as an emitter (tested below).
    ([name]) => name !== 'flagHem' && name !== 'glassLit',
  ),
  ...(['topsoil', 'subsoil', 'clay', 'rock', 'asphalt'] as const).map((name): [string, string] => [
    name,
    MATERIAL_COLORS[name],
  ]),
  ['trunk', WORLD_COLORS.trunk],
];

/** Grass and leaves: the yard's own greens, near the sewer's green in hue, so told apart below. */
const greens: [string, string][] = [
  ['grass', MATERIAL_COLORS.grass],
  ['grassLight', MATERIAL_COLORS.grassLight],
  ['grassPatch', MATERIAL_COLORS.grassPatch],
  ['foliage', WORLD_COLORS.foliage],
  ['foliageDark', WORLD_COLORS.foliageDark],
  ['shrub', WORLD_COLORS.shrub],
];

describe('the yard’s colors', () => {
  it.each(themes)('%s: nothing but a mark reads as one of the eight mark colors', (name) => {
    const key = hexToRgb(THEMES[name].scene.key.color);
    const light = [srgbToLinear(key.r), srgbToLinear(key.g), srgbToLinear(key.b)];
    for (const [thing, hex] of notMarks) {
      for (const k of [0.35, 0.7, 1]) {
        const seen = shown(hex, light, k);
        for (const code of MARKS_APWA) {
          const mark = shown(APWA[code].fill, light, k);
          if (code === 'white') {
            // A pale neutral reads as white paint: keep well darker than it, or plainly colored.
            const colored = seen.c > 0.06;
            expect(colored || mark.l - seen.l >= 0.15, `${thing} as white at ${String(k)}x`).toBe(
              true,
            );
            continue;
          }
          if (hueDistance(seen.h, mark.h) > 35) continue;
          const weaker = seen.c <= mark.c * 0.6;
          const apart = Math.abs(seen.l - mark.l) >= 0.2;
          expect(weaker || apart, `${thing} as ${code} at ${String(k)}x`).toBe(true);
        }
      }
    }
  });

  it.each(themes)(
    '%s: grass and leaves read as no mark color but green, and flags stand out from them',
    (name) => {
      const key = hexToRgb(THEMES[name].scene.key.color);
      const light = [srgbToLinear(key.r), srgbToLinear(key.g), srgbToLinear(key.b)];
      for (const [thing, hex] of greens) {
        for (const k of [0.35, 0.7, 1]) {
          const seen = shown(hex, light, k);
          for (const code of MARKS_APWA) {
            if (code === 'green' || code === 'white') continue;
            const mark = shown(APWA[code].fill, light, k);
            if (hueDistance(seen.h, mark.h) > 35) continue;
            const weaker = seen.c <= mark.c * 0.6;
            const apart = Math.abs(seen.l - mark.l) >= 0.2;
            expect(weaker || apart, `${thing} as ${code} at ${String(k)}x`).toBe(true);
          }
          // Every flag's hem is far lighter than the grass it stands on: a little less so in deep
          // shade, where everything's lightness draws together.
          const hem = shown(YARD_COLORS.flagHem, light, k);
          expect(
            hem.l - seen.l,
            `the hem against ${thing} at ${String(k)}x`,
          ).toBeGreaterThanOrEqual(k < 0.5 ? 0.13 : 0.18);
        }
      }
    },
  );

  it('lights windows at night as a dim lamplight, never a mark’s white or yellow', () => {
    // An emitter, as the screen shows it at its glow.
    const lit = shown(YARD_COLORS.glassLit, [1, 1, 1], WINDOW_LIT);
    for (const code of ['white', 'yellow'] as const) {
      const mark = shown(APWA[code].fill, [1, 1, 1], 1);
      const weaker = lit.c <= mark.c * 0.6;
      const apart = Math.abs(lit.l - mark.l) >= 0.2;
      expect(weaker || apart, code).toBe(true);
    }
    expect(WINDOW_LIT).toBeLessThan(1);
  });

  it('dims the other marks only a little, and glows well under bloom', () => {
    expect(MARK_LOOK.dim).toBeGreaterThanOrEqual(0.6);
    expect(MARK_LOOK.dim).toBeLessThan(1);
    expect(MARK_LOOK.nightGlow).toBeLessThan(1);
    expect(MARK_LOOK.glow.strength).toBeLessThan(1);
  });
});
