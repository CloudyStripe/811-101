/**
 * The Gas & Petroleum diorama in use: both tours run from the seafloor to their quiz, which reads
 * out each answer, and the end offers the other tour; every stop opens from the map, focus moving
 * to its heading, and a stop's label and the keys open its neighbors, with the live status and the
 * address following; the path switch, the fork, the overview's turn within its bounds, and the
 * motion pause; the formation time-lapse, which plays when asked even with the rest paused;
 * definitions; and a lost graphics context, after which the view draws again.
 */
import type { Page } from '@playwright/test';
import {
  OVERVIEW,
  QUIZZES,
  STOPS,
  TERMS,
  TOURS,
  stopById,
} from '../../content/utilities/gas-petroleum.ts';
import { stopName, stopSummary } from '../../src/pages/gas-petroleum/summary.ts';
import { expect, test, waitReady } from './fixtures.ts';

type Counted = Window & { draws?: number };

/** Counts the page's WebGL draws, from before it loads: `drawn()` says how many so far. */
async function countDraws(page: Page): Promise<() => Promise<number>> {
  await page.addInitScript(() => {
    const w = window as Counted;
    w.draws = 0;
    const gl = WebGL2RenderingContext.prototype;
    for (const name of [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
    ]) {
      const draw: unknown = Reflect.get(gl, name);
      if (typeof draw !== 'function') continue;
      Reflect.set(gl, name, function (this: unknown, ...args: unknown[]) {
        w.draws = (w.draws ?? 0) + 1;
        Reflect.apply(draw, this, args);
      });
    }
  });
  return () => page.evaluate(() => (window as Counted).draws ?? 0);
}

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
    const other = key === 'gas' ? 'gasoline' : 'gas';
    await guide(page)
      .getByRole('button', { name: `Take the ${TOURS[other].name.toLowerCase()} tour` })
      .click();
    await expect(guide(page)).toContainText(`Step 1 of ${String(TOURS[other].stops.length)}`);
  });
}

test('every stop opens from the map, and the status, address and focus follow', async ({
  page,
}) => {
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

  // Paused, the time-lapse still plays when asked, and the rest stays paused.
  await open(page, '&stop=formation');
  await dock(page).getByRole('button', { name: 'Pause the motion' }).click();
  await guide(page).getByRole('button', { name: 'Play the formation time-lapse' }).click();
  await expect(guide(page).getByRole('button', { name: 'Playing…' })).toBeVisible();
  const clock = guide(page).locator('.tl-clock');
  await expect(clock).toHaveText(/million years ago/);
  const first = (await clock.textContent()) ?? '';
  await expect(clock, 'the replay moves on').not.toHaveText(first);
  await expect(dock(page).getByRole('button', { name: 'Play the motion' })).toBeVisible();
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the overview stays alive, and the pause stills it', async ({ page }) => {
    const drawn = await countDraws(page);
    await open(page);
    const moving = async (ms = 500) => {
      const before = await drawn();
      await page.waitForTimeout(ms);
      return (await drawn()) > before;
    };
    await expect.poll(() => moving(), { message: 'the overview moves' }).toBe(true);
    await dock(page).getByRole('button', { name: 'Pause the motion' }).click();
    let last = -1;
    let quiet = 0;
    await expect
      .poll(
        async () => {
          const now = await drawn();
          quiet = now === last ? quiet + 1 : 0;
          last = now;
          return quiet;
        },
        { message: 'paused, it holds still', intervals: [1000] },
      )
      .toBeGreaterThanOrEqual(2);
    await dock(page).getByRole('button', { name: 'Play the motion' }).click();
    await expect.poll(() => moving(), { message: 'playing, it moves again' }).toBe(true);
  });
});

test('losing the graphics context: a clear message, then a clean recovery', async ({ page }) => {
  const drawn = await countDraws(page);
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
  const before = await drawn();
  await page.evaluate(() => {
    (window as Window & { restoreGl?: () => void }).restoreGl?.();
  });
  await expect(message).toBeHidden();
  // The view is drawn again, not left blank.
  await expect.poll(() => drawn(), { message: 'drawn again' }).toBeGreaterThan(before);
});
