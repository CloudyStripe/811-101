import { LEGACY_ROOT_HOSTS, expect, test } from './fixtures.ts';

test.use({ allowHosts: LEGACY_ROOT_HOSTS });

test('the root page is still the original diorama', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('From Rock to Flame');
  await expect(page.locator('#scene')).toBeVisible();
});

test('the diorama links to the Frequency Lab, and the lab links back', async ({ page }) => {
  // Two 3D pages in one test.
  test.setTimeout(test.info().timeout * 2);

  await test.step('from the diorama to the lab', async () => {
    await page.goto('./');
    // Leaving before its scripts and fonts arrive would cut those requests short.
    await page.waitForLoadState('load');
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.getByRole('link', { name: /Frequency Lab/ }).click();
    await expect(page).toHaveURL(/\/training\/frequency-lab\//);
    await expect(page.getByRole('heading', { name: 'Frequency Lab' })).toBeVisible();
  });

  await test.step('and back', async () => {
    // Likewise, the lab's 3D code has arrived once its scene is ready.
    await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
      timeout: 90_000,
    });
    await page.getByRole('link', { name: 'Back to From Rock to Flame' }).click();
    await expect(page).toHaveTitle('From Rock to Flame');
  });
});
