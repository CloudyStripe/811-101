/**
 * Screenshots for review: every listed state at desktop and phone sizes, in light and dark.
 * Captured in `?capture` mode (fixed time and tier, one settled frame) so they're deterministic.
 */
import { expect, test } from './fixtures.ts';

const STATES = [
  { name: 'steel-512', setup: 'steel', f: 512 },
  { name: 'steel-83k', setup: 'steel', f: 83_000 },
  { name: 'tracer-512', setup: 'tracer', f: 512 },
  { name: 'tracer-33k', setup: 'tracer', f: 33_000 },
] as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, scale: 1, tier: 'high' },
  { name: 'phone', width: 390, height: 844, scale: 2, tier: 'medium' },
] as const;

for (const theme of ['light', 'dark'] as const) {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} ${theme}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.scale,
        colorScheme: theme,
        hasTouch: vp.name === 'phone',
        isMobile: vp.name === 'phone',
      });
      for (const s of STATES) {
        test(s.name, async ({ page }) => {
          await page.goto(
            `training/frequency-lab/?setup=${s.setup}&f=${s.f}&tier=${vp.tier}&capture`,
          );
          await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
            timeout: 60_000,
          });
          await page.screenshot({
            path: `artifacts/screenshots/${theme}-${vp.name}-${s.name}.png`,
          });

          // No clipped or overlapping labels.
          const boxes = await page.$$eval('.lbl:not(.off):not([hidden])', (els) =>
            els.map((e) => {
              const r = e.getBoundingClientRect();
              return {
                id: (e as HTMLElement).dataset.label ?? '',
                x: r.x,
                y: r.y,
                w: r.width,
                h: r.height,
              };
            }),
          );
          for (const b of boxes) {
            expect(b.x, `${b.id} clipped left`).toBeGreaterThanOrEqual(0);
            expect(b.y, `${b.id} clipped top`).toBeGreaterThanOrEqual(0);
            expect(b.x + b.w, `${b.id} clipped right`).toBeLessThanOrEqual(vp.width);
            expect(b.y + b.h, `${b.id} clipped bottom`).toBeLessThanOrEqual(vp.height);
          }
          boxes.forEach((a, i) => {
            for (const b of boxes.slice(i + 1)) {
              const overlap =
                a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
              expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
            }
          });
        });
      }
    });
  }
}
