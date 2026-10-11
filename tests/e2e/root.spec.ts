import { LEGACY_ROOT_HOSTS, expect, test } from './fixtures.ts';

test.use({ allowHosts: LEGACY_ROOT_HOSTS });

test('the root page is still the original diorama', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('From Rock to Flame');
  await expect(page.locator('#scene')).toBeVisible();
});
