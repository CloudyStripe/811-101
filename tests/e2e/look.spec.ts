/**
 * The look, measured on real frames. The squint test: with everything but the 3D view hidden,
 * every pixel that isn't the sky's own gradient for its row is the model (or its shadow), and the
 * model's average lightness must stand well clear of the sky's, by day and by night, in both 3D
 * views, so the model reads at a glance, never as a beige smudge on beige.
 */
import type { Page } from '@playwright/test';
import { backdropAt } from '../../src/kit3d/backdrop.ts';
import { THEMES, labSceneTokens, type SceneTokens } from '../../src/design/tokens.ts';
import { expect, test, waitReady } from './fixtures.ts';

/** The least gap in OKLab lightness between the model and the sky behind it. */
const SQUINT_GAP = 0.12;

interface Squint {
  model: number;
  sky: number;
  /** The model's share of the view. */
  share: number;
}

/** Measures the view as drawn: the model's and the sky's average lightness. */
async function squint(page: Page, tokens: SceneTokens): Promise<Squint> {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('no canvas');
  const png = await page.screenshot({
    clip: box,
    style: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }',
  });
  // The sky's color for each row of the view, as authored.
  const rows = Array.from({ length: Math.round(box.height) }, (_, y) =>
    backdropAt(tokens, y / Math.max(1, box.height - 1)).map((c) => Math.round(c * 255)),
  );
  return page.evaluate(
    async ({ data, rows }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(img, 0, 0);
      const { data: px } = ctx.getImageData(0, 0, img.width, img.height);
      /** OKLab lightness of an sRGB pixel. */
      const lightness = (r: number, g: number, b: number) => {
        const lin = (c: number) => {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
        const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
        const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
        const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
        return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
      };
      let model = 0;
      let sky = 0;
      let modelCount = 0;
      let skyCount = 0;
      for (let y = 0; y < img.height; y++) {
        const row = rows[Math.min(rows.length - 1, Math.floor((y / img.height) * rows.length))];
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          const [r, g, b] = [px[i] ?? 0, px[i + 1] ?? 0, px[i + 2] ?? 0];
          const l = lightness(r, g, b);
          const isSky =
            row !== undefined &&
            Math.abs(r - (row[0] ?? 0)) <= 6 &&
            Math.abs(g - (row[1] ?? 0)) <= 6 &&
            Math.abs(b - (row[2] ?? 0)) <= 6;
          if (isSky) {
            sky += l;
            skyCount++;
          } else {
            model += l;
            modelCount++;
          }
        }
      }
      return {
        model: model / Math.max(1, modelCount),
        sky: sky / Math.max(1, skyCount),
        share: modelCount / (img.width * img.height),
      };
    },
    { data: png.toString('base64'), rows },
  );
}

// No fades: the loader is gone the moment the view draws, so nothing veils the frame measured.
test.use({ reducedMotion: 'reduce' });

const VIEWS = [
  { name: 'lab', path: 'training/frequency-lab/?capture&tier=medium', tokens: labSceneTokens },
  {
    name: 'diorama',
    path: 'utilities/gas-petroleum/?capture&tier=medium',
    tokens: (theme: 'light' | 'dark') => THEMES[theme].scene,
  },
] as const;

for (const view of VIEWS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${view.name}, ${theme}: the model stands clear of the sky`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(view.path);
      await waitReady(page);
      await expect(page.locator('.scene-loader')).toBeHidden();
      const s = await squint(page, view.tokens(theme));
      // The sky really is the sky's gradient (most of the view), and the model takes real room.
      expect(s.share, 'model share').toBeGreaterThan(0.12);
      expect(s.share, 'model share').toBeLessThan(0.8);
      expect(
        Math.abs(s.model - s.sky),
        `model ${s.model.toFixed(3)}, sky ${s.sky.toFixed(3)}`,
      ).toBeGreaterThanOrEqual(SQUINT_GAP);
    });
  }
}
