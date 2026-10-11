/**
 * Accessibility: axe with the WCAG 2.2 AA rules, in both themes, at desktop and phone sizes, with
 * the settings, the About dialog and the phone sheet open. Violations fail the run; items axe
 * can't decide on its own (such as text over the 3D view) are listed for a person to check.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function open(page: Page) {
  await page.goto('training/frequency-lab/?tier=low');
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
}

async function scan(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const item of results.incomplete) {
    console.log(`${name}: needs review: ${item.id} (${String(item.nodes.length)}) ${item.help}`);
  }
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    name,
  ).toEqual([]);
}

test.use({ reducedMotion: 'reduce' });

for (const theme of ['light', 'dark'] as const) {
  test.describe(theme, () => {
    test.use({ colorScheme: theme });

    test('desktop: the lab, settings, the guide closed, and About', async ({ page }) => {
      await open(page);
      await scan(page, `${theme} desktop`);
      await page.getByRole('button', { name: 'Settings' }).click();
      await scan(page, `${theme} settings`);
      await page.keyboard.press('Escape');
      await page.getByRole('radio', { name: 'Plastic main' }).click();
      await scan(page, `${theme} plastic`);
      await page.getByRole('button', { name: 'Close the lab guide' }).click();
      await scan(page, `${theme} guide closed`);
      await page.getByRole('button', { name: 'Open the lab guide' }).click();
      await page.getByRole('button', { name: 'About this model' }).click();
      await expect(page.getByRole('dialog', { name: 'About this model' })).toBeVisible();
      await scan(page, `${theme} About`);
    });

    test.describe('phone', () => {
      test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

      test('the lab with the sheet closed and open', async ({ page }) => {
        await open(page);
        await scan(page, `${theme} phone`);
        await page.getByRole('button', { name: 'Details' }).tap();
        await scan(page, `${theme} phone sheet`);
      });
    });
  });
}
