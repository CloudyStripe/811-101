/**
 * The layout between the two designed sizes: tablets, phones held sideways, small laptops, and a
 * 1280×1024 screen zoomed to 400% (320×256, WCAG 1.4.10). Every control must be reachable and on
 * top where it's clicked, and the chrome must never overlap.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const SIZES = [
  { name: 'tablet-portrait', width: 820, height: 1180, touch: true },
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
  { name: 'small-laptop', width: 1024, height: 768, touch: false },
  { name: 'zoomed-400', width: 320, height: 256, touch: false },
] as const;

/** Whether the control is what's actually on top at its center, after scrolling it into view. */
async function onTop(page: Page, selector: string, index: number) {
  const control = page.locator(selector).nth(index);
  await control.scrollIntoViewIfNeeded();
  return control.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && (hit === el || el.contains(hit));
  });
}

test.use({ reducedMotion: 'reduce' });

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch,
    });

    test('every control is reachable and on top; no chrome overlaps', async ({ page }) => {
      await page.goto('training/frequency-lab/?tier=low');
      await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
        timeout: 60_000,
      });
      await page.screenshot({ path: `artifacts/screenshots/layout-${size.name}.png` });

      const radios = '[role="radio"]';
      const buttons = '.lab-camera button';
      for (const [selector, count] of [
        [radios, await page.locator(radios).count()],
        [buttons, await page.locator(buttons).count()],
      ] as const) {
        for (let i = 0; i < count; i++) {
          expect(await onTop(page, selector, i), `${selector} #${String(i)} is covered`).toBe(true);
        }
      }

      // Clicking the last frequency works even when the page had to scroll to it.
      await page.getByRole('radio', { name: '83 kilohertz' }).click();
      await expect(page.locator('.readout')).toContainText('510 mA');

      const chrome = await page.$$eval('[data-chrome]', (els) =>
        els.flatMap((e) => {
          const r = e.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return [];
          return [{ id: e.getAttribute('class') ?? '', x: r.x, y: r.y, w: r.width, h: r.height }];
        }),
      );
      chrome.forEach((a, i) => {
        for (const b of chrome.slice(i + 1)) {
          const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
          expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
        }
      });
    });
  });
}
