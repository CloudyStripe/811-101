/**
 * The portal and the ways between pages: the home page shows all three sections, links to every
 * lesson and says what's coming; each lesson links back. The built pages carry the brand and the
 * settings script before any of their JavaScript runs. Plus axe in both themes.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { BRAND } from '../../config/brand.ts';
import { SECTIONS } from '../../content/portal.ts';
import { SETTINGS_KEY } from '../../src/site/settings.ts';
import { DIORAMA_HOSTS, expect, test } from './fixtures.ts';

/** Opens the portal and waits until everything on it, previews included, is loaded and decoded. */
async function openPortal(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: BRAND.name, level: 1 })).toBeVisible();
  await page.waitForLoadState('load');
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
}

/** The portal's own address, with nothing after it. */
const PORTAL_URL = /\/811-101\/$/;

test('the portal shows every section, its lessons, and what’s coming', async ({ page }) => {
  await openPortal(page);
  await expect(page).toHaveTitle(BRAND.name);
  for (const section of SECTIONS) {
    const card = page.getByRole('region', { name: section.title });
    await expect(card).toBeVisible();
    await expect(card).toContainText(section.summary);
    const links = card.getByRole('link');
    await expect(links).toHaveCount(section.lessons.length);
    if (section.lessons.length === 0) await expect(card).toContainText('Coming soon');
    for (const lesson of section.lessons) {
      const link = card.getByRole('link', { name: lesson.title, exact: true });
      await expect(link).toHaveAttribute('href', `/811-101/${lesson.href}`);
    }
  }
  // The previews are real images, not broken ones.
  for (const img of await page.locator('img.lesson-image').all()) {
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(960);
  }
});

test('the built pages carry the brand and the settings script before any JavaScript runs', async ({
  page,
}) => {
  const portal = await (await page.request.get('./')).text();
  expect(portal).toContain(`<title>${BRAND.name}</title>`);
  expect(portal).toContain(`<h1>${BRAND.name}</h1>`);
  expect(portal).not.toContain('%BRAND_');
  const lab = await (await page.request.get('training/frequency-lab/')).text();
  for (const html of [portal, lab]) expect(html).toContain(SETTINGS_KEY);
  // The diorama is published as it is.
  const diorama = await (await page.request.get('utilities/gas-petroleum/')).text();
  expect(diorama).not.toContain(SETTINGS_KEY);
});

test('a page that isn’t there is a 404, as on the live site', async ({ page }) => {
  for (const path of ['training/', 'utilities/', 'no-such-lesson/']) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
});

test('the portal opens the Frequency Lab, and the lab comes back', async ({ page }) => {
  await openPortal(page);
  await page.getByRole('link', { name: 'Frequency Lab', exact: true }).click();
  // The lab adds its setup and frequency to the address.
  await expect(page).toHaveURL(/\/training\/frequency-lab\/(\?|$)/);
  // Leaving before the lab's 3D code arrives would cut those requests short.
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 90_000,
  });
  await page.getByRole('link', { name: 'All lessons' }).click();
  await expect(page).toHaveURL(PORTAL_URL);
  await expect(page).toHaveTitle(BRAND.name);
});

test.describe('the diorama', () => {
  test.use({ allowHosts: DIORAMA_HOSTS });

  test('is the original, now under Utility Education, and comes back', async ({ page }) => {
    await openPortal(page);
    await page.getByRole('link', { name: 'Gas & Petroleum', exact: true }).click();
    await expect(page).toHaveURL(/\/utilities\/gas-petroleum\/$/);
    await expect(page).toHaveTitle('From Rock to Flame');
    await expect(page.locator('#scene')).toBeVisible();
    // Leaving before its scripts and fonts arrive would cut those requests short.
    await page.waitForLoadState('load');
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.getByRole('link', { name: 'All lessons' }).click();
    await expect(page).toHaveURL(PORTAL_URL);
    await expect(page).toHaveTitle(BRAND.name);
  });
});

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, scale: 1, mobile: false },
  { name: 'phone', width: 390, height: 844, scale: 2, mobile: true },
] as const;

for (const theme of ['light', 'dark'] as const) {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} ${theme}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.scale,
        colorScheme: theme,
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
        reducedMotion: 'reduce',
      });

      test('passes axe, and nothing runs off the side', async ({ page }) => {
        await openPortal(page);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(
          results.violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
          ),
        ).toEqual([]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
      });
    });
  }
}
