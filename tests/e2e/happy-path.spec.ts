/**
 * The lab's happy path, by pointer and by keyboard: setups and frequencies drive the readout,
 * the chart and its table, the explanation and the live summary; About, settings and the
 * definitions on labels and terms work and get out of the way; on phones the guide is a sheet.
 * Expected values come from the model, so a recalibration doesn't break the tests.
 */
import type { Page } from '@playwright/test';
import { FREQUENCIES, frequencyLabel, type Frequency } from '../../config/equipment.ts';
import { reachSummary, stateSummary } from '../../src/pages/frequency-lab/summary.ts';
import { transmitterReading, type SetupId } from '../../src/signal/model.ts';
import { expect, test } from './fixtures.ts';

async function open(page: Page) {
  await page.goto('training/frequency-lab/?tier=low');
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
}

async function expectState(page: Page, setup: SetupId, f: Frequency) {
  const reading = transmitterReading(setup, f);
  const readout = page.locator('.readout');
  await expect(readout).toContainText(`${String(Math.round(reading.ma))} mA`);
  await expect(readout).toContainText(`${String(reading.ohms)} Ω`);
  await expect(page.locator('#lab-status')).toHaveText(stateSummary(setup, f));
  await expect(page.locator('.chart-reach-text')).toHaveText(reachSummary(setup, f));
  await expect(page.locator('.lab-panel')).toContainText(`At ${frequencyLabel(f)}`);
}

test.use({ reducedMotion: 'reduce' });

test('setups and frequencies drive the readout, chart, table and explanation', async ({ page }) => {
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

  // Pointer: back to 512 Hz. The chart's line moves with it.
  const line = page.locator('.chart-target');
  const at83k = (await line.getAttribute('d')) ?? '';
  await dial.getByRole('radio', { name: '512 hertz' }).click();
  await expectState(page, 'steel', 512);
  await expect(line).not.toHaveAttribute('d', at83k);

  // The table says what the chart shows, starting from the transmitter's current.
  await page.getByRole('button', { name: 'Show as table' }).click();
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  const atHookup = String(Math.round(transmitterReading('steel', 512).ma));
  await expect(table.getByRole('row').nth(1)).toContainText(atHookup);

  // The plastic main: the tracer wire carries the signal.
  await page.getByRole('radio', { name: 'Plastic main' }).click();
  await expectState(page, 'plastic', 512);
  await expect(table).toContainText('Tracer wire (mA)');
  await expect(page.locator('.lab-panel')).toContainText('Find the tracer wire');
});

test('About, settings, and the definitions on labels and terms', async ({ page }) => {
  await open(page);

  // About this model opens, closes on Escape, and hands focus back.
  const about = page.getByRole('button', { name: 'About this model' });
  await about.click();
  const dialog = page.getByRole('dialog', { name: 'About this model' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Distances are compressed');
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
  await expect(labelTip).toContainText('The metal pipe carries the signal');
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
    const view = page.getByRole('toolbar', { name: 'View' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(heading).toBeHidden();
    await expect(page.getByRole('radiogroup', { name: 'Transmitter frequency' })).toBeVisible();

    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(heading).toBeVisible();
    await expect(view).toBeHidden();

    // The dial stays usable with the sheet open.
    await page.getByRole('radio', { name: '83 kilohertz' }).tap();
    await expectState(page, 'steel', 83_000);

    await toggle.tap();
    await expect(heading).toBeHidden();
    await expect(view).toBeVisible();
  });
});
