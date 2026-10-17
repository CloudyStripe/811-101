/**
 * The Gas & Petroleum diorama in use: Start walks the shared start to the fork, which waits for the
 * reader to choose a path; both tours run from the seafloor to their quiz, which reads out each
 * answer, and the end offers the other path from the fork; every stop opens from the map, focus moving
 * to its heading, and a stop's label and the keys open its neighbors, with the live status and the
 * address following; the path switch and the fork; the camera, turned all the way round by its
 * buttons and keys, tilted to its limits, dragged, zoomed and panned, the arrival landing on any
 * input, and the view drawing only while something moves; the motion pause; the formation
 * time-lapse, stepped through or played, even with the rest paused; the labels the view names:
 * where it is and where it goes next; definitions; and a lost graphics context, after which the
 * view draws again.
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
import {
  MOTION_WAIT,
  countFrames,
  expect,
  isMoving,
  test,
  waitReady,
  waitStill,
} from './fixtures.ts';

async function open(page: Page, query = '') {
  await page.goto(`utilities/gas-petroleum/?tier=low${query}`);
  await waitReady(page);
}

const guide = (page: Page) => page.locator('.gp-panel');
const dock = (page: Page) => page.locator('.gp-dock');
const status = (page: Page) => page.locator('#gp-status');
/** The view's canvas, which carries where the camera stands: data-heading, -tilt, -zoom and -at. */
const view = (page: Page) => page.locator('.gp-canvas');
/**
 * A point over the view that nothing covers, label or control, all round it: where a drag, the
 * wheel or a right-drag reaches the view itself. Found again before each, as the labels move.
 */
async function openSpot(page: Page): Promise<{ x: number; y: number }> {
  const spot = await page.evaluate(() => {
    const canvas = document.querySelector('.gp-canvas');
    const around = [
      [0, 0],
      [-24, 0],
      [24, 0],
      [0, -24],
      [0, 24],
    ] as const;
    for (let y = 120; y < innerHeight - 160; y += 30) {
      for (let x = 40; x < innerWidth * 0.6; x += 30) {
        if (around.every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) === canvas)) {
          return { x, y };
        }
      }
    }
    return null;
  });
  if (!spot) throw new Error('nowhere over the view is clear of labels and controls');
  return spot;
}

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
  // Showing gasoline, → goes on along gasoline.
  await page
    .getByRole('radiogroup', { name: 'Show' })
    .getByRole('radio', { name: 'Gasoline path' })
    .click();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.keyboard.press('ArrowRight');
  await expect(status(page)).toHaveText(stopSummary('crude-transport'));
  // With the view focused, the arrows turn the camera instead: the stop stays.
  await expect(view(page)).toHaveAttribute('data-heading', /\d/);
  const heading = await view(page).getAttribute('data-heading');
  await view(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(view(page)).not.toHaveAttribute('data-heading', heading ?? '');
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

test('the camera turns all the way round by its buttons and keys, in the overview and at a stop', async ({
  page,
}) => {
  // Dozens of camera moves, each drawn in software.
  test.slow();
  await open(page);
  const camera = page.getByRole('group', { name: 'Camera' });
  const right = camera.getByRole('button', { name: 'Turn right' });
  await expect(view(page)).toHaveAttribute('data-heading', /\d/);
  const start = (await view(page).getAttribute('data-heading')) ?? '';
  // Eighteen presses of a button go all the way round. (Pressed by Enter: a click held too long
  // by a busy software renderer would count as a press held, which goes on turning.)
  await right.focus();
  await page.keyboard.press('Enter');
  await expect(view(page)).not.toHaveAttribute('data-heading', start);
  for (let i = 1; i < 18; i++) await page.keyboard.press('Enter');
  await expect(view(page)).toHaveAttribute('data-heading', start);
  // Tilting stops at its limit, and the button says so; zoomed in too, Reset view sets it back.
  const up = camera.getByRole('button', { name: 'Tilt up' });
  await view(page).focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowUp');
  await expect(up).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('+');
  await expect(view(page)).not.toHaveAttribute('data-zoom', '1.00');
  await camera.getByRole('button', { name: 'Reset view' }).click();
  await expect(up).not.toHaveAttribute('aria-disabled', 'true');
  await expect(view(page)).toHaveAttribute('data-zoom', '1.00');
  // At a stop, framed nearer than the overview, eighteen of ← with the view focused go all the
  // way round too, and Home goes back to the stop's own view.
  await guide(page)
    .getByRole('button', { name: stopName('city-gate') })
    .click();
  await expect(status(page)).toHaveText(stopSummary('city-gate'));
  await expect(view(page)).toHaveAttribute('data-zoom', /^0\.\d\d$/);
  const atStop = (await view(page).getAttribute('data-heading')) ?? '';
  const zoom = (await view(page).getAttribute('data-zoom')) ?? '';
  await view(page).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(view(page)).not.toHaveAttribute('data-heading', atStop);
  for (let i = 1; i < 18; i++) await page.keyboard.press('ArrowLeft');
  await expect(view(page)).toHaveAttribute('data-heading', atStop);
  await camera.getByRole('button', { name: 'Zoom in' }).click();
  await expect(view(page)).not.toHaveAttribute('data-zoom', zoom);
  await view(page).focus();
  await page.keyboard.press('Home');
  await expect(view(page)).toHaveAttribute('data-zoom', zoom);
  await expect(status(page)).toHaveText(stopSummary('city-gate'));
});

test('a camera button held goes on turning, and a click turns a step', async ({ page }) => {
  // A few camera moves, each drawn in software.
  test.slow();
  await open(page);
  const right = page
    .getByRole('group', { name: 'Camera' })
    .getByRole('button', { name: 'Turn right' });
  await expect(view(page)).toHaveAttribute('data-heading', /\d/);
  const heading = async () => Number(await view(page).getAttribute('data-heading'));
  /** How far round it turned, in whole degrees, from a heading to another. */
  const turned = (from: number, to: number) => (to - from + 360) % 360;
  const start = await heading();
  await right.click();
  await expect.poll(async () => turned(start, await heading())).toBe(20);
  // Held for a while, it turns step after step.
  const box = await right.boundingBox();
  if (!box) throw new Error('no Turn right button');
  const before = await heading();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2000);
  await page.mouse.up();
  await expect.poll(async () => turned(before, await heading())).toBeGreaterThanOrEqual(40);
});

test('a drag turns the view, the wheel zooms, a right-drag pans, and the hint goes', async ({
  page,
}) => {
  // A handful of camera moves, each drawn in software.
  test.slow();
  await open(page);
  const hint = page.locator('.gp-hint');
  await expect(hint).toBeVisible();
  await expect(view(page)).toHaveAttribute('data-heading', /\d/);
  const where = () =>
    view(page).evaluate((c) => Object.fromEntries(Object.entries((c as HTMLElement).dataset)));
  const before = await where();
  // A click, as on a stop, isn't a move: the hint stays.
  let at = await openSpot(page);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(500);
  await expect(hint).not.toHaveAttribute('data-gone', '');
  at = await openSpot(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 200, at.y, { steps: 6 });
  await page.mouse.up();
  await expect(view(page)).not.toHaveAttribute('data-heading', before.heading ?? '');
  await expect(hint).toBeHidden();
  at = await openSpot(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(0, -300);
  await expect
    .poll(async () => Number(await view(page).getAttribute('data-zoom')))
    .toBeLessThan(Number(before.zoom));
  // A trackpad's pinch comes as the wheel with Ctrl held: it zooms the same way, within limits.
  const wheeled = Number(await view(page).getAttribute('data-zoom'));
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Control');
  await expect
    .poll(async () => Number(await view(page).getAttribute('data-zoom')))
    .toBeLessThan(wheeled);
  // A right-drag moves what the view looks at, and not its angle.
  const turned = await where();
  at = await openSpot(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(at.x + 120, at.y + 60, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await expect(view(page)).not.toHaveAttribute('data-at', turned.at ?? '');
  await expect(view(page)).toHaveAttribute('data-heading', turned.heading ?? '');
  await expect(view(page)).toHaveAttribute('data-tilt', turned.tilt ?? '');
});

test('a definition shows on hover, and the time-lapse plays on request', async ({ page }) => {
  // Two loads of the diorama, and a time-lapse played through, in software.
  test.slow();
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

type Arrival = Window & { zooms?: string[]; pressedAt?: number };

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the arrival comes in from farther out, and a key lands it at once', async ({ page }) => {
    // Every zoom the view reports, in order, and how many came before the first key went down.
    await page.addInitScript(() => {
      const w = window as Arrival;
      const zooms: string[] = [];
      w.zooms = zooms;
      new MutationObserver((changes) => {
        const zoom = (changes[0]?.target as HTMLElement | undefined)?.dataset.zoom;
        if (zoom !== undefined && zoom !== zooms.at(-1)) zooms.push(zoom);
      }).observe(document, { subtree: true, attributeFilter: ['data-zoom'] });
      addEventListener(
        'keydown',
        () => {
          w.pressedAt ??= zooms.length;
        },
        true,
      );
    });
    await page.goto('utilities/gas-petroleum/?tier=low');
    // The first frame drawn, checked for every frame, so the key goes down while it's coming in.
    await page.waitForFunction(() => ((window as Arrival).zooms?.length ?? 0) > 0, null, {
      polling: 'raf',
      timeout: 60_000,
    });
    await page.keyboard.press('Shift');
    await expect(view(page)).toHaveAttribute('data-zoom', '1.00');
    const { zooms = [], pressedAt = 0 } = await page.evaluate(() => {
      const w = window as Arrival;
      return { zooms: w.zooms, pressedAt: w.pressedAt };
    });
    // Farther out than the overview when the key went down, and at the overview the next frame.
    expect(Number(zooms[0]), `zooms ${zooms.join(' ')}`).toBeGreaterThan(1.3);
    expect(Number(zooms[pressedAt - 1]), `zooms ${zooms.join(' ')}`).toBeGreaterThan(1);
    expect(zooms.slice(pressedAt)).toEqual(['1.00']);
  });

  test('paused, the view draws while a drag moves it, then sleeps', async ({ page }) => {
    // Stillness to wait for twice, and a drag drawn between, in software.
    test.slow();
    const frames = await countFrames(page);
    await open(page);
    await dock(page).getByRole('button', { name: 'Pause the motion' }).click();
    await waitStill(page, 'paused, it holds still');
    const before = await frames();
    const at = await openSpot(page);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 200, at.y, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => frames(), { message: 'the drag is drawn' }).toBeGreaterThan(before);
    await waitStill(page, 'settled, it sleeps again');
    expect(await isMoving(page, frames), 'and stays asleep').toBe(false);
  });

  test('the overview stays alive, and the pause stills it', async ({ page }) => {
    // Motion to show twice, and stillness to hold, in software.
    test.slow();
    const frames = await countFrames(page);
    await open(page);
    await expect
      .poll(() => isMoving(page, frames), { message: 'the overview moves', timeout: MOTION_WAIT })
      .toBe(true);
    await dock(page).getByRole('button', { name: 'Pause the motion' }).click();
    await waitStill(page, 'paused, it holds still');
    expect(await isMoving(page, frames), 'and stays still').toBe(false);
    await dock(page).getByRole('button', { name: 'Play the motion' }).click();
    await expect
      .poll(() => isMoving(page, frames), {
        message: 'playing, it moves again',
        timeout: MOTION_WAIT,
      })
      .toBe(true);
  });
});

test('losing the graphics context: a clear message, then a clean recovery', async ({ page }) => {
  // The whole view built again after the loss, its shaders compiled anew, in software.
  test.slow();
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
