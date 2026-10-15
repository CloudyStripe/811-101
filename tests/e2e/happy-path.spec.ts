/**
 * The lab's happy path, by pointer and by keyboard: setups and frequencies drive the guide and
 * the live summary; the guide closes and opens; About, settings and the definitions on labels
 * and terms work and get out of the way; on phones the guide is a sheet. Expected text comes
 * from the content and the model, so rewording or recalibrating doesn't break the tests.
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

/** The live summary and the guide both say what the view shows. */
async function expectState(page: Page, setup: SetupId, f: Frequency) {
  const summary = stateSummary(setup, f);
  await expect(page.locator('#lab-status')).toHaveText(summary);
  await expect(page.locator('.lab-panel')).toContainText(summary, { useInnerText: true });
}

test.use({ reducedMotion: 'reduce' });

test('setups and frequencies drive the guide and the live summary', async ({ page }) => {
  await open(page);
  await expectState(page, 'steel', 512);

  // Keyboard: step the dial up through every frequency.
  const dial = page.getByRole('radiogroup', { name: 'Transmitter frequency' });
  await dial.getByRole('radio', { checked: true }).focus();
  for (const f of FREQUENCIES.slice(1)) {
    await page.keyboard.press('ArrowRight');
    await expect(dial.getByRole('radio', { checked: true })).toHaveText(frequencyLabel(f));
    await expectState(page, 'steel', f);
  }

  // Pointer: back to 512 Hz, then the plastic main, where the tracer wire carries the signal.
  await dial.getByRole('radio', { name: '512 hertz' }).click();
  await expectState(page, 'steel', 512);
  await page.getByRole('radio', { name: 'Plastic main' }).click();
  await expectState(page, 'plastic', 512);
  await expect(page.locator('.lab-panel')).toContainText('Find the tracer wire');
});

test('the guide closes down to its title, and opens again', async ({ page }) => {
  await open(page);
  const panel = page.locator('.lab-panel');
  const body = page.getByRole('heading', { name: 'How it works' });
  const close = page.getByRole('button', { name: 'Close the lab guide' });
  await expect(body).toBeVisible();
  const openHeight = (await panel.boundingBox())?.height ?? 0;

  await close.click();
  const reopen = page.getByRole('button', { name: 'Open the lab guide' });
  await expect(reopen).toBeFocused();
  await expect(reopen).toHaveAttribute('aria-expanded', 'false');
  await expect(body).toBeHidden();
  // Closed, it's just its title: the view has the room.
  expect((await panel.boundingBox())?.height ?? 0).toBeLessThan(openHeight / 4);

  await reopen.click();
  await expect(page.getByRole('button', { name: 'Close the lab guide' })).toBeFocused();
  await expect(body).toBeVisible();
});

test('About, settings, and the definitions on labels and terms', async ({ page }) => {
  await open(page);

  // About this model opens, closes on Escape, and hands focus back.
  const about = page.getByRole('button', { name: 'About this model' });
  await about.click();
  const dialog = page.getByRole('dialog', { name: 'About this model' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Distances are shortened');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(about).toBeFocused();

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

  // A term's definition shows on hover and stays while the pointer moves onto it.
  const term = page
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

  test('the guide is a sheet over the transmitter', async ({ page }) => {
    await open(page);
    const toggle = page.getByRole('button', { name: 'Details' });
    const heading = page.getByRole('heading', { name: "What's happening" });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(heading).toBeHidden();
    await expect(page.locator('.sheet-summary')).toHaveText(stateSummary('steel', 512));
    await expect(page.getByRole('radiogroup', { name: 'Transmitter frequency' })).toBeVisible();

    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(heading).toBeVisible();
    // On a phone this tall, the view stays in sight above the open sheet, framed again there.
    await expect(page.locator('[data-label="target"]')).not.toHaveClass(/\b(off|capped)\b/);

    // The dial stays usable with the sheet open.
    await page.getByRole('radio', { name: '83 kilohertz' }).tap();
    await expectState(page, 'steel', 83_000);

    await toggle.tap();
    await expect(heading).toBeHidden();
  });
});

test('only one definition shows at a time, and Escape closes it from anywhere', async ({
  page,
}) => {
  await open(page);
  const visibleTips = page.locator('[role="tooltip"]:visible');
  const terms = page.locator('.lab-panel .term');

  // Going from term to term, pressing Enter on each, never leaves more than one tip open. (Focus
  // moves straight to each: the guide's folding sections sit between them in the tab order.)
  for (let i = 0; i < 3; i++) {
    await terms.nth(i).focus();
    await page.keyboard.press('Enter');
    await expect(visibleTips).toHaveCount(1);
  }

  // With focus on one term, hovering another, a section away, swaps which tip shows.
  await terms.nth(0).focus();
  await expect(visibleTips).toHaveCount(1);
  const far = page.locator('.lab-panel .term-wrap').last();
  await far.getByRole('button').hover();
  await expect(visibleTips).toHaveCount(1);
  await expect(far.getByRole('tooltip')).toBeVisible();

  // Escape closes it, wherever focus is, and focus stays put.
  await page.keyboard.press('Escape');
  await expect(visibleTips).toHaveCount(0);
  await expect(terms.nth(0)).toBeFocused();
});
