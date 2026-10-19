/**
 * Accessibility: axe with the WCAG 2.2 AA rules, in both themes, at desktop and phone sizes, with
 * the settings, the guide, the key and the About dialog open, and the key finding a line.
 * Violations fail the run; items axe can't decide on its own (such as text over the 3D view) are
 * listed for a person to check.
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

/** The console's button that opens the guide or the key. */
const toggle = (page: Page, name: 'Guide' | 'Key') =>
  page.getByRole('region', { name: 'Controls' }).getByRole('button', { name, exact: true });

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

    test('desktop: the lab, settings, the guide open, and About', async ({ page }) => {
      // Five full scans of the 3D page: with every browser busy, it outruns the usual limit.
      test.slow();
      await open(page);
      await scan(page, `${theme} desktop`);
      await page.getByRole('button', { name: 'Settings' }).click();
      await scan(page, `${theme} settings`);
      await page.keyboard.press('Escape');
      await page.getByRole('radio', { name: 'Plastic main' }).click();
      await scan(page, `${theme} plastic`);
      await toggle(page, 'Guide').click();
      await scan(page, `${theme} guide open`);
      await page.getByRole('button', { name: 'About this model' }).click();
      await expect(page.getByRole('dialog', { name: 'About this model' })).toBeVisible();
      await scan(page, `${theme} About`);
    });

    test.describe('wide', () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test('the key open, finding a line, and the signal paused', async ({ page }) => {
        await open(page);
        await toggle(page, 'Key').click();
        const key = page.getByRole('region', { name: 'Key' });
        await key.getByRole('button', { name: 'Telecom cable' }).hover();
        await expect(page.locator('[data-label="telecom"]')).toHaveClass(/\blit\b/);
        await scan(page, `${theme} wide, key`);
        await page.getByRole('button', { name: 'Pause the signal' }).click();
        await scan(page, `${theme} wide, paused`);
      });
    });

    test.describe('phone', () => {
      test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

      test('the lab with the guide closed and open', async ({ page }) => {
        await open(page);
        await scan(page, `${theme} phone`);
        await toggle(page, 'Guide').tap();
        await scan(page, `${theme} phone guide`);
      });
    });
  });
}

/** The diorama, open at a stop or at its overview. */
async function openDiorama(page: Page, stop = '') {
  await page.goto(`utilities/gas-petroleum/?tier=low${stop ? `&stop=${stop}` : ''}`);
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`diorama ${theme}`, () => {
    test.use({ colorScheme: theme });

    test('desktop: the overview, a stop with its safety tip, and a quiz answered', async ({
      page,
    }) => {
      test.slow();
      await openDiorama(page);
      await scan(page, `${theme} diorama overview`);
      await openDiorama(page, 'city-gate');
      await scan(page, `${theme} diorama city gate`);
      await openDiorama(page);
      await page.getByRole('button', { name: 'Natural gas tour' }).click();
      const guide = page.locator('.gp-panel');
      for (let i = 0; i < 8; i++) await guide.getByRole('button', { name: /^Next: / }).click();
      await guide.getByRole('button', { name: 'Take the quiz' }).click();
      await page.locator('.q').first().getByRole('button').first().click();
      await scan(page, `${theme} diorama quiz`);
    });

    test.describe('phone', () => {
      test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

      test('the diorama with the sheet closed and open', async ({ page }) => {
        await openDiorama(page, 'formation');
        await scan(page, `${theme} diorama phone`);
        await page.getByRole('button', { name: 'Details' }).tap();
        await scan(page, `${theme} diorama phone sheet`);
      });
    });
  });
}
