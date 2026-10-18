/**
 * Labels off, in each lesson: no name shows anywhere in the 3D view (the lab's tools and lines; the
 * diorama's stops and their parts), while the diorama's numbered markers stay, naming a stop only
 * while its marker is hovered or focused. The step bar, the guide and its map are controls, not
 * labels, so they keep their names. A name counts only where it's drawn at its size: a marker's
 * name kept for screen readers, clipped to a pixel, doesn't.
 */
import { expect, shownNames, test } from './fixtures.ts';

test('the lab, labels off: no name shows in its view', async ({ page }) => {
  await page.goto('training/frequency-lab/?tier=low');
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
  await expect.poll(() => shownNames(page)).not.toEqual([]);
  await page
    .getByRole('region', { name: 'Controls' })
    .getByRole('button', { name: 'Labels', exact: true })
    .click();
  await expect.poll(() => shownNames(page)).toEqual([]);
});

test('the diorama, labels off: no name shows in its view, and a marker names its stop only while hovered or focused', async ({
  page,
}) => {
  // Two views drawn in software.
  test.slow();
  await page.goto('utilities/gas-petroleum/?tier=low&stop=city-gate');
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
  // On: the open stop's name, the others' where they fit, and its parts'.
  await expect.poll(() => shownNames(page)).toContain('City gate');
  const toggle = page
    .getByRole('region', { name: 'Controls' })
    .getByRole('button', { name: 'Labels', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => shownNames(page)).toEqual([]);
  // The numbered markers stay, the open stop's too, and each still opens its stop.
  const marker = page.locator('[data-label="city-gate"] .mk-btn');
  await expect(marker).toBeVisible();
  // Hovered, a marker names its stop, and only it; moved off, the name goes again.
  await marker.hover();
  await expect.poll(() => shownNames(page)).toEqual(['City gate']);
  await page.mouse.move(2, 400);
  await expect.poll(() => shownNames(page)).toEqual([]);
  // Focused, too.
  await marker.focus();
  await expect.poll(() => shownNames(page)).toEqual(['City gate']);
  await marker.blur();
  await expect.poll(() => shownNames(page)).toEqual([]);
  // The step bar, a control, keeps its words; and the overview shows no names either.
  await expect(page.locator('.gp-panel .stepbar')).toContainText('Step 8 of 9');
  await page.locator('.gp-panel').getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.locator('[data-label="city-gate"] .mk-btn')).toBeVisible();
  await expect.poll(() => shownNames(page)).toEqual([]);
  // A stop is still a click on its marker away. The marker, focused and under the pointer, names
  // it until both move on.
  const pipeline = page.locator('[data-label="pipeline"] .mk-btn');
  await pipeline.click();
  await expect(page).toHaveURL(/[?&]stop=pipeline(&|$)/);
  await page.mouse.move(2, 400);
  await pipeline.blur();
  await expect.poll(() => shownNames(page)).toEqual([]);
});
