/**
 * The lab's happy path, by pointer and by keyboard: setups and frequencies drive the guide and
 * the live summary; the guide and the key open one at a time between the view and the console,
 * never over the lines, and close by their button or Escape; About, settings and the definitions
 * on labels and terms work and get out of the way; on phones the summary stays on screen. Expected
 * text comes from the content and the model, so rewording or recalibrating doesn't break the tests.
 */
import type { Page } from '@playwright/test';
import { FREQUENCIES, frequencyLabel, type Frequency } from '../../config/equipment.ts';
import { stateSummary } from '../../src/pages/frequency-lab/summary.ts';
import type { SetupId } from '../../src/signal/model.ts';
import { expect, test } from './fixtures.ts';

async function open(page: Page) {
  await page.goto('training/frequency-lab/?tier=low');
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
}

const drawer = (page: Page) => page.locator('#lab-drawer');
const toggle = (page: Page, name: 'Guide' | 'Key') =>
  page.getByRole('region', { name: 'Controls' }).getByRole('button', { name, exact: true });

/** The live summary, and the guide when it's open, both say what the view shows. */
async function expectState(page: Page, setup: SetupId, f: Frequency) {
  const summary = stateSummary(setup, f);
  await expect(page.locator('#lab-status')).toHaveText(summary);
  if (await drawer(page).isVisible()) {
    await expect(drawer(page)).toContainText(summary, { useInnerText: true });
  }
}

/** Whether the label is clear of the drawer: the view is framed above it. */
async function aboveDrawer(page: Page, id: string) {
  const label = await page.locator(`[data-label="${id}"] .lbl-btn`).boundingBox();
  const sheet = await drawer(page).boundingBox();
  return label !== null && sheet !== null && label.y + label.height <= sheet.y;
}

test.use({ reducedMotion: 'reduce' });

test('setups and frequencies drive the guide and the live summary', async ({ page }) => {
  await open(page);
  await toggle(page, 'Guide').click();
  await expectState(page, 'steel', 512);

  // Keyboard: step the frequencies up, one button at a time.
  const frequency = page.getByRole('radiogroup', { name: 'Frequency' });
  await frequency.getByRole('radio', { checked: true }).focus();
  for (const f of FREQUENCIES.slice(1)) {
    await page.keyboard.press('ArrowRight');
    await expect(frequency.getByRole('radio', { checked: true })).toHaveText(frequencyLabel(f));
    await expectState(page, 'steel', f);
  }
  // Home and End jump to the ends.
  await page.keyboard.press('Home');
  await expect(frequency.getByRole('radio', { name: '512 hertz' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(frequency.getByRole('radio', { checked: true })).toHaveAccessibleName(
    '83 kilohertz',
  );

  // Pointer: back to 512 Hz, then the plastic main, where the tracer wire carries the signal.
  await frequency.getByRole('radio', { name: '512 hertz' }).click();
  await expectState(page, 'steel', 512);
  await page.getByRole('radio', { name: 'Plastic main' }).click();
  await expectState(page, 'plastic', 512);
  await expect(drawer(page)).toContainText('Find the tracer wire');
});

test('the guide and the key open one at a time, above the console, and close by button or Escape', async ({
  page,
}) => {
  await open(page);
  const guide = toggle(page, 'Guide');
  const key = toggle(page, 'Key');
  await expect(drawer(page)).toBeHidden();
  await expect(guide).toHaveAttribute('aria-expanded', 'false');

  // The guide opens, with focus on its heading, and the view frames the lines above it.
  await guide.click();
  await expect(guide).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('heading', { name: 'Lab guide' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
  await expect
    .poll(() => aboveDrawer(page, 'target'), { message: 'the main above the guide' })
    .toBe(true);

  // The key takes its place: one drawer at a time.
  await key.click();
  await expect(key).toHaveAttribute('aria-expanded', 'true');
  await expect(guide).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: 'Key' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeHidden();

  // Escape closes it, and hands focus back to its button.
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toBeHidden();
  await expect(key).toBeFocused();
  await expect(key).toHaveAttribute('aria-expanded', 'false');

  // So does its own close button.
  await guide.click();
  await page.getByRole('button', { name: 'Close the lab guide' }).click();
  await expect(drawer(page)).toBeHidden();
  await expect(guide).toBeFocused();
});

test('About, settings, and the definitions on labels and terms', async ({ page }) => {
  // Two loads of the lab, a dialog, the settings and several tips, in software.
  test.slow();
  await open(page);

  // About this model, from the guide, opens, closes on Escape, and hands focus back.
  await toggle(page, 'Guide').click();
  const about = page.getByRole('button', { name: 'About this model' });
  await about.click();
  const dialog = page.getByRole('dialog', { name: 'About this model' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Distances are shortened');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(about).toBeFocused();
  // The guide stays open under it.
  await expect(drawer(page)).toBeVisible();

  // Settings apply at once and are remembered across visits.
  const html = page.locator('html');
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('radio', { name: 'Dark' }).check();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await settings.getByRole('radio', { name: 'Reduced' }).check();
  await expect(html).toHaveAttribute('data-motion', 'reduce');
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await open(page);
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-motion', 'reduce');
  await page.getByRole('button', { name: 'Settings' }).click();
  await settings.getByRole('radio', { name: 'Match device' }).first().check();
  await expect(html).not.toHaveAttribute('data-theme', /.+/);

  // A label's definition shows on focus, and Escape dismisses it.
  await page.keyboard.press('Escape');
  const label = page.locator('[data-label="target"]');
  await label.getByRole('button').focus();
  const labelTip = label.getByRole('tooltip');
  await expect(labelTip).toBeVisible();
  await expect(labelTip).toContainText('The metal carries the signal');
  await page.keyboard.press('Escape');
  await expect(labelTip).toBeHidden();
  await expect(label.getByRole('button')).toBeFocused();

  // A term's definition, in the guide, shows on hover and stays while the pointer moves onto it.
  await toggle(page, 'Guide').click();
  const term = drawer(page)
    .locator('.term-wrap')
    .filter({ hasText: /^transmitter/ })
    .first();
  await term.getByRole('button').hover();
  const termTip = term.getByRole('tooltip');
  await expect(termTip).toBeVisible();
  await termTip.hover();
  await page.waitForTimeout(300);
  await expect(termTip).toBeVisible();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the summary stays on screen, and the frequency buttons work with the guide open', async ({
    page,
  }) => {
    await open(page);
    const summary = page.locator('#lab-status');
    await expect(summary).toHaveText(stateSummary('steel', 512));
    await expect(summary).toBeInViewport();

    await toggle(page, 'Guide').tap();
    await expect(page.getByRole('heading', { name: "What's happening" })).toBeVisible();
    // The view stays in sight above the open guide, framed again there, with the summary under it.
    await expect(page.locator('[data-label="target"]')).not.toHaveClass(/\b(off|capped)\b/);
    await expect.poll(() => aboveDrawer(page, 'target')).toBe(true);
    await expect(summary).toBeInViewport();

    // The frequency buttons stay usable with the guide open.
    await page.getByRole('radio', { name: '83 kilohertz' }).tap();
    await expectState(page, 'steel', 83_000);
    await expect(summary).toBeInViewport();

    await toggle(page, 'Guide').tap();
    await expect(drawer(page)).toBeHidden();
  });
});

test('only one definition shows at a time, and Escape closes it from anywhere', async ({
  page,
}) => {
  await open(page);
  await toggle(page, 'Guide').click();
  const visibleTips = page.locator('[role="tooltip"]:visible');
  const terms = drawer(page).locator('.term');

  // Going from term to term, pressing Enter on each, never leaves more than one tip open.
  for (let i = 0; i < 3; i++) {
    await terms.nth(i).focus();
    await page.keyboard.press('Enter');
    await expect(visibleTips).toHaveCount(1);
  }

  // With focus on one term, hovering another, a section away, swaps which tip shows.
  await terms.nth(0).focus();
  await expect(visibleTips).toHaveCount(1);
  const far = drawer(page).locator('.term-wrap').last();
  await far.getByRole('button').hover();
  await expect(visibleTips).toHaveCount(1);
  await expect(far.getByRole('tooltip')).toBeVisible();

  // Escape closes the tip, wherever focus is, and focus stays put; the guide stays open.
  await page.keyboard.press('Escape');
  await expect(visibleTips).toHaveCount(0);
  await expect(terms.nth(0)).toBeFocused();
  await expect(drawer(page)).toBeVisible();
});
