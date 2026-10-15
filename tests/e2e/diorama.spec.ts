/**
 * The Gas & Petroleum diorama in use: Start walks the shared start to the fork, which waits for the
 * reader to choose a path; both tours run from the seafloor to their quiz, which reads out each
 * answer, and the end offers the other path from the fork; every stop opens from the map, focus moving
 * to its heading, and a stop's label and the keys open its neighbors, with the live status and the
 * address following; the path switch, the fork, the overview's turn within its bounds, and the
 * motion pause; the formation time-lapse, stepped through or played, even with the rest paused;
 * the labels the view names: where it is and where it goes next;
 * definitions; and a lost graphics context, after which the view draws again.
 */
import type { Page } from '@playwright/test';
import {
  OVERVIEW,
  QUIZZES,
  STOPS,
  TERMS,
  TIMELAPSE,
  TOURS,
  stopById,
} from '../../content/utilities/gas-petroleum.ts';
import { stopName, stopSummary } from '../../src/pages/gas-petroleum/summary.ts';
import { countFrames, expect, isMoving, test, waitReady } from './fixtures.ts';

async function open(page: Page, query = '') {
  await page.goto(`utilities/gas-petroleum/?tier=low${query}`);
  await waitReady(page);
}

const guide = (page: Page) => page.locator('.gp-panel');
const dock = (page: Page) => page.locator('.gp-dock');
const status = (page: Page) => page.locator('#gp-status');
const filterChecked = (page: Page) =>
  page.getByRole('radiogroup', { name: 'Show' }).getByRole('radio', { checked: true });

test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

for (const key of ['gas', 'gasoline'] as const) {
  const tour = TOURS[key];
  test(`the ${tour.name.toLowerCase()} tour runs from the seafloor to its quiz`, async ({
    page,
  }) => {
    await open(page);
    const start = guide(page).getByRole('button', { name: `${tour.name} tour` });
    await expect(start).toContainText(`${String(tour.stops.length)} steps`);
    await start.click();
    // The tour shows its own path, and the guide steps through it.
    await expect(filterChecked(page)).toHaveText(key === 'gas' ? 'Natural gas' : 'Gasoline');
    for (const [i, id] of tour.stops.entries()) {
      await expect(guide(page)).toContainText(
        `Step ${String(i + 1)} of ${String(tour.stops.length)}`,
      );
      await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(
        stopById(id).title.text,
      );
      await expect(status(page)).toHaveText(stopSummary(id));
      const next = i === tour.stops.length - 1 ? 'Take the quiz' : 'Next step';
      await guide(page).getByRole('button', { name: next }).click();
    }
    await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(
      'Quick check: 3 questions',
    );
    // Each answer is marked and explained, and read out too.
    const said = guide(page).locator('[aria-live="polite"]');
    for (const q of QUIZZES[key]) {
      await guide(page).getByRole('button', { name: q.options[q.answer], exact: true }).click();
      await expect(guide(page)).toContainText(q.why.text);
      await expect(said).toContainText('Correct.');
    }
    await expect(guide(page)).toContainText('You got 3 of 3.');
    await expect(said).toContainText('You got 3 of 3.');
    // The end leads on: to the next lesson, to all of them, or the other path.
    await expect(
      guide(page).getByRole('link', { name: 'On to the Frequency Lab' }),
    ).toHaveAttribute('href', '/811-101/training/frequency-lab/');
    await expect(guide(page).getByRole('link', { name: 'All lessons' })).toHaveAttribute(
      'href',
      '/811-101/',
    );
    // The other path starts from the fork, so the shared start isn't walked again.
    const other = key === 'gas' ? 'gasoline' : 'gas';
    await guide(page)
      .getByRole('button', {
        name: `Take the ${TOURS[other].name.toLowerCase()} path, from the fork`,
      })
      .click();
    await expect(guide(page)).toContainText(`Step 4 of ${String(TOURS[other].stops.length)}`);
    await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(
      stopById('lifting').title.text,
    );
    await expect(guide(page).getByRole('link', { name: 'On to the Frequency Lab' })).toHaveCount(0);
  });
}

test('Start walks the shared start to the fork, which waits for a path to be chosen', async ({
  page,
}) => {
  await open(page);
  await guide(page).getByRole('button', { name: 'Start at the beginning' }).click();
  for (const step of [1, 2, 3]) {
    await expect(guide(page)).toContainText(`Step ${String(step)} of 4`);
    await guide(page).getByRole('button', { name: 'Next step' }).click();
  }
  // The fork: the way on is a choice of path.
  await expect(guide(page)).toContainText('Step 4 of 4');
  await expect(status(page)).toHaveText(stopSummary('lifting'));
  await expect(guide(page).getByRole('button', { name: 'Next step' })).toBeDisabled();
  await expect(filterChecked(page)).toHaveText('Both');
  await guide(page)
    .getByRole('group', { name: 'Choose a path' })
    .getByRole('button', { name: /Gasoline path/ })
    .click();
  // On down the path chosen, which the view shows.
  await expect(guide(page)).toContainText(`Step 5 of ${String(TOURS.gasoline.stops.length)}`);
  await expect(status(page)).toHaveText(stopSummary('crude-transport'));
  await expect(filterChecked(page)).toHaveText('Gasoline');
  await expect(guide(page).getByRole('heading', { level: 2 })).toBeFocused();
  // Back at the fork, the path chosen is marked, and Next goes on along it.
  await guide(page).getByRole('button', { name: 'Back' }).click();
  await expect(guide(page).getByRole('button', { name: /Gasoline path.*your path/ })).toBeVisible();
  await guide(page).getByRole('button', { name: 'Next step' }).click();
  await expect(status(page)).toHaveText(stopSummary('crude-transport'));
});

test('at the fork, the dock leads to the choice, and going down a path chooses it', async ({
  page,
}) => {
  await open(page);
  await guide(page).getByRole('button', { name: 'Start at the beginning' }).click();
  // Stepping with the dock, as on a phone with the sheet closed.
  for (let i = 0; i < 3; i++) await dock(page).getByRole('button', { name: 'Next step' }).click();
  await expect(status(page)).toHaveText(stopSummary('lifting'));
  await dock(page).getByRole('button', { name: 'Choose a path' }).click();
  await expect(guide(page).getByRole('button', { name: /Natural gas path/ })).toBeFocused();
  // Opening the gas plant from its label goes down the natural gas path, which the view shows.
  await page.locator('[data-label="gas-plant"] .lbl-btn').focus();
  await page.keyboard.press('Enter');
  await expect(guide(page)).toContainText(`Step 5 of ${String(TOURS.gas.stops.length)}`);
  await expect(filterChecked(page)).toHaveText('Natural gas');
});

test('every stop opens from the map, and the status, address and focus follow', async ({
  page,
}) => {
  // All thirteen stops, each from the overview's map: long under software rendering.
  test.slow();
  await open(page);
  for (const stop of STOPS) {
    if (await dock(page).getByRole('button', { name: 'Overview' }).isVisible()) {
      await dock(page).getByRole('button', { name: 'Overview' }).click();
    }
    await guide(page)
      .getByRole('button', { name: stopName(stop.id) })
      .click();
    await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(stop.title.text);
    await expect(status(page)).toHaveText(stopSummary(stop.id));
    await expect(page).toHaveURL(new RegExp(`[?&]stop=${stop.id}(&|$)`));
    // The map went with the overview, so focus moved to the stop's heading.
    await expect(guide(page).getByRole('heading', { level: 2 })).toBeFocused();
  }
  await dock(page).getByRole('button', { name: 'Overview' }).click();
  await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(OVERVIEW.title.text);
  await expect(page).not.toHaveURL(/stop=/);
});

test("a stop's label opens it, and a link to a stop opens there", async ({ page }) => {
  await open(page, '&stop=city-gate');
  await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(
    stopById('city-gate').title.text,
  );
  await expect(guide(page)).toContainText('Safety tip:');
  // The view names where it is and where it goes next (where there's room); the other stops'
  // labels wait for focus.
  await expect(page.locator('[data-label="city-gate"]')).not.toHaveClass(/\b(off|capped)\b/);
  await expect(page.locator('[data-label="formation"]')).toHaveClass(/\b(off|capped)\b/);
  expect(await page.locator('.lbl:not(.off):not(.capped)').count()).toBeLessThanOrEqual(2);
  // A label out of sight for want of room still takes focus, and shows when it has it.
  const label = page.locator('[data-label="pump"] .lbl-btn');
  await label.focus();
  await expect(page.locator('[data-label="pump"]')).not.toHaveClass(/\b(off|capped)\b/);
  await page.keyboard.press('Enter');
  await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(
    stopById('pump').title.text,
  );
});

test('the fork offers both paths, and the keys follow the path chosen', async ({ page }) => {
  await open(page, '&stop=lifting');
  await expect(guide(page)).toContainText(stopById('lifting').note?.text ?? '');
  await expect(guide(page).getByRole('button', { name: 'Natural gas path' })).toBeVisible();
  await expect(guide(page).getByRole('button', { name: 'Gasoline path' })).toBeVisible();
  // With both paths showing, → goes on along natural gas.
  await page.locator('body').press('ArrowRight');
  await expect(status(page)).toHaveText(stopSummary('gas-plant'));
  await page.locator('body').press('ArrowLeft');
  await expect(status(page)).toHaveText(stopSummary('lifting'));
  // Showing gasoline, → goes on along gasoline, from the view too: at a stop, it doesn't turn.
  await page
    .getByRole('radiogroup', { name: 'Show' })
    .getByRole('radio', { name: 'Gasoline path' })
    .click();
  await page.locator('.gp-canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect(status(page)).toHaveText(stopSummary('crude-transport'));
  // Opening a stop on the path that isn't showing brings both paths back.
  await page
    .getByRole('radiogroup', { name: 'Show' })
    .getByRole('radio', { name: 'Natural gas path' })
    .click();
  await dock(page).getByRole('button', { name: 'Overview' }).click();
  await guide(page)
    .getByRole('button', { name: stopName('pump') })
    .click();
  await expect(filterChecked(page)).toHaveText('Both');
});

test('the overview turns within its bounds, by buttons and keys, and sets straight', async ({
  page,
}) => {
  await open(page);
  const left = dock(page).getByRole('button', { name: 'Turn left' });
  const right = dock(page).getByRole('button', { name: 'Turn right' });
  for (let i = 0; i < 4; i++) {
    if (await left.isDisabled()) break;
    await left.click();
  }
  await expect(left).toBeDisabled();
  await expect(right).toBeEnabled();
  await dock(page).getByRole('button', { name: 'Reset view' }).click();
  await expect(left).toBeEnabled();
  // With the model focused, the arrow keys turn it, and Home sets it straight.
  await page.locator('.gp-canvas').focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(right).toBeDisabled();
  await page.keyboard.press('Home');
  await expect(right).toBeEnabled();
  // Turned as far as it goes, then a stop: back in the overview, it's straight, and turns again.
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(right).toBeDisabled();
  await guide(page)
    .getByRole('button', { name: stopName('pump') })
    .click();
  await dock(page).getByRole('button', { name: 'Overview' }).click();
  await expect(right).toBeEnabled();
});

test('a definition shows on hover, and the time-lapse plays on request', async ({ page }) => {
  await open(page);
  const term = guide(page)
    .locator('.term-wrap')
    .filter({ hasText: /^refinery/ });
  await term.getByRole('button').hover();
  await expect(term.getByRole('tooltip')).toHaveText(TERMS.refinery?.text ?? '');

  // The time-lapse steps back through how the layers formed, held still at each step.
  await open(page, '&stop=formation');
  const clock = guide(page).locator('.tl-clock');
  const earlier = guide(page).getByRole('button', { name: 'Earlier in the time-lapse' });
  const later = guide(page).getByRole('button', { name: 'Later in the time-lapse' });
  await expect(clock).toHaveText('Today');
  await expect(later).toBeDisabled();
  await earlier.click();
  await expect(clock).toHaveText(/million years ago/);
  // Later again is today, all the way back.
  await later.click();
  await expect(clock).toHaveText('Today');
  await expect(later).toBeDisabled();
  for (let i = 1; i < TIMELAPSE.length; i++) await earlier.click();
  await expect(clock).toHaveText(`≈ ${String(TIMELAPSE[0]?.ma)} million years ago`);
  await expect(earlier).toBeDisabled();
  // Paused, the time-lapse still plays when asked, and the rest stays paused.
  await dock(page).getByRole('button', { name: 'Pause the motion' }).click();
  await guide(page).getByRole('button', { name: 'Play the formation time-lapse' }).click();
  await expect(guide(page).getByRole('button', { name: 'Playing…' })).toBeVisible();
  await expect(clock).toHaveText(/million years ago/);
  const first = (await clock.textContent()) ?? '';
  await expect(clock, 'the replay moves on').not.toHaveText(first);
  await expect(dock(page).getByRole('button', { name: 'Play the motion' })).toBeVisible();
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the overview stays alive, and the pause stills it', async ({ page }) => {
    const frames = await countFrames(page);
    await open(page);
    await expect.poll(() => isMoving(page, frames), { message: 'the overview moves' }).toBe(true);
    await dock(page).getByRole('button', { name: 'Pause the motion' }).click();
    // Still once two whole seconds pass without a frame (one asked for may land late), and then
    // it stays still.
    let last = -1;
    let quiet = 0;
    await expect
      .poll(
        async () => {
          const now = await frames();
          quiet = now === last ? quiet + 1 : 0;
          last = now;
          return quiet;
        },
        { message: 'paused, it holds still', intervals: [1000] },
      )
      .toBeGreaterThanOrEqual(2);
    expect(await isMoving(page, frames), 'and stays still').toBe(false);
    await dock(page).getByRole('button', { name: 'Play the motion' }).click();
    await expect
      .poll(() => isMoving(page, frames), { message: 'playing, it moves again' })
      .toBe(true);
  });
});

test('losing the graphics context: a clear message, then a clean recovery', async ({ page }) => {
  const frames = await countFrames(page);
  await open(page);
  await page.evaluate(() => {
    const ext = document
      .querySelector('canvas')
      ?.getContext('webgl2')
      ?.getExtension('WEBGL_lose_context');
    (window as Window & { restoreGl?: () => void }).restoreGl = () => ext?.restoreContext();
    ext?.loseContext();
  });
  const message = page.locator('.stage-message');
  await expect(message).toBeVisible();
  const before = await frames();
  await page.evaluate(() => {
    (window as Window & { restoreGl?: () => void }).restoreGl?.();
  });
  await expect(message).toBeHidden();
  // The view is drawn again, not left blank.
  await expect.poll(() => frames(), { message: 'drawn again' }).toBeGreaterThan(before);
});
