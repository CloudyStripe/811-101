/**
 * The Gas & Petroleum diorama in use: Start walks the shared start to the fork, where the step
 * bar's way on is the choice of path; both tours run from the seafloor to their quiz, which reads
 * out each answer, and the end offers the other path from the fork; a stop opened from its marker
 * steps along its own path; every stop opens from the map, focus moving to its heading, with the
 * live status and the address following; all thirteen markers on the model, in their paths'
 * shapes, named where there's room (on a phone, while open or focused); the keys and the path
 * switch at the fork; the camera, turned all the way round by its buttons and keys, tilted to its
 * limits, dragged, zoomed and panned, the arrival landing on any input, and the view drawing only
 * while something moves; the motion pause; the formation time-lapse, stepped through or played,
 * even with the rest paused; definitions; and a lost graphics context, after which the view draws
 * again.
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
  type StopId,
} from '../../content/utilities/gas-petroleum.ts';
import { PATH_STYLE } from '../../src/design/paths.ts';
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

/** Opens a stop from its marker by keyboard, once the marker shows: one out of view can't be focused. */
async function openMarker(page: Page, id: StopId) {
  const marker = page.locator(`[data-label="${id}"]`);
  await expect(marker, `${id}'s marker shows`).not.toHaveClass(/\boff\b/);
  await marker.locator('.mk-btn').focus();
  await expect(marker.locator('.mk-btn')).toBeFocused();
  await page.keyboard.press('Enter');
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
      // Next names the stop it goes to, and the last one, the quiz.
      const on = tour.stops[i + 1];
      const next = on ? `Next: ${stopById(on).label}` : 'Take the quiz';
      await guide(page).getByRole('button', { name: next, exact: true }).click();
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

test('Start walks the shared start to the fork, where the way on is the choice of path', async ({
  page,
}) => {
  await open(page);
  await guide(page).getByRole('button', { name: 'Start at the beginning' }).click();
  for (const step of [1, 2, 3]) {
    await expect(guide(page)).toContainText(`Step ${String(step)} of 4`);
    await guide(page)
      .getByRole('button', { name: /^Next: / })
      .click();
  }
  // The fork: the step bar's way on is the choice of path.
  await expect(guide(page)).toContainText('Step 4 of 4');
  await expect(status(page)).toHaveText(stopSummary('lifting'));
  await expect(guide(page).getByRole('button', { name: /^Next/ })).toHaveCount(0);
  await expect(filterChecked(page)).toHaveText('Both');
  await guide(page).getByRole('button', { name: 'Choose a path' }).click();
  await expect(guide(page).getByRole('button', { name: /Natural gas path/ })).toBeFocused();
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
  await guide(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(guide(page).getByRole('button', { name: /Gasoline path.*your path/ })).toBeVisible();
  await guide(page)
    .getByRole('button', { name: /^Next: / })
    .click();
  await expect(status(page)).toHaveText(stopSummary('crude-transport'));
});

test('a stop opened from its marker steps along its own path; a shared one waits for the choice', async ({
  page,
}) => {
  await open(page);
  // A stop of a path: its path's steps, counting the shared start, on to its quiz.
  await openMarker(page, 'distillation');
  await expect(guide(page)).toContainText(`Step 6 of ${String(TOURS.gasoline.stops.length)}`);
  await guide(page)
    .getByRole('button', { name: /^Next: / })
    .click();
  await expect(status(page)).toHaveText(stopSummary('delivery'));
  // A stop of the shared start, with both paths showing: the choice waits at the fork.
  await guide(page).getByRole('button', { name: 'Overview', exact: true }).click();
  await openMarker(page, 'drilling');
  await expect(guide(page)).toContainText('Step 3 of 4');
  await guide(page)
    .getByRole('button', { name: /^Next: / })
    .click();
  await guide(page).getByRole('button', { name: 'Choose a path' }).click();
  await expect(guide(page).getByRole('button', { name: /Natural gas path/ })).toBeFocused();
  // Opening the gas plant from its marker goes down the natural gas path, which the view shows.
  await openMarker(page, 'gas-plant');
  await expect(guide(page)).toContainText(`Step 5 of ${String(TOURS.gas.stops.length)}`);
  await expect(filterChecked(page)).toHaveText('Natural gas');
});

test('every stop opens from the map, and the status, address and focus follow', async ({
  page,
}) => {
  // All thirteen stops, each from the overview's map: long under software rendering.
  test.slow();
  await open(page);
  const overview = guide(page).getByRole('button', { name: 'Overview', exact: true });
  for (const stop of STOPS) {
    if (await overview.isVisible()) await overview.click();
    await guide(page)
      .getByRole('button', { name: stopName(stop.id) })
      .click();
    await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(stop.title.text);
    await expect(status(page)).toHaveText(stopSummary(stop.id));
    await expect(page).toHaveURL(new RegExp(`[?&]stop=${stop.id}(&|$)`));
    // The map went with the overview, so focus moved to the stop's heading.
    await expect(guide(page).getByRole('heading', { level: 2 })).toBeFocused();
  }
  await overview.click();
  await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(OVERVIEW.title.text);
  await expect(page).not.toHaveURL(/stop=/);
});

test("every stop's marker shows on the model, named where there's room, and opens its stop", async ({
  page,
}) => {
  // Two pages and thirteen markers, under software rendering.
  test.slow();
  await open(page);
  // All thirteen, each in its path's shape, and on a wide screen most of them by name, none over
  // another.
  for (const stop of STOPS) {
    const marker = page.locator(`[data-label="${stop.id}"]`);
    await expect(marker, stop.id).not.toHaveClass(/\boff\b/);
    await expect(marker.locator('.pshape')).toHaveAttribute(
      'data-shape',
      PATH_STYLE[stop.path].shape,
    );
  }
  const named = await page.locator('.mk:not(.off):not(.compact)').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: (el as HTMLElement).dataset.label ?? '',
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
      };
    }),
  );
  expect(named.length).toBeGreaterThanOrEqual(9);
  for (const [i, a] of named.entries()) {
    for (const b of named.slice(i + 1)) {
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      expect(apart, `${a.id} over ${b.id}`).toBe(true);
    }
  }
  // A marker opens its stop, which it names while it's open, in ink.
  await openMarker(page, 'city-gate');
  await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(
    stopById('city-gate').title.text,
  );
  await expect(guide(page)).toContainText('Safety tip:');
  await expect(page).toHaveURL(/[?&]stop=city-gate(&|$)/);
  const here = page.locator('[data-label="city-gate"]');
  await expect(here).toHaveAttribute('data-tier', 'current');
  await expect(here).not.toHaveClass(/\b(off|compact)\b/);
  // A link to a stop opens there.
  await open(page, '&stop=pump');
  await expect(guide(page).getByRole('heading', { level: 2 })).toHaveText(
    stopById('pump').title.text,
  );
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the markers show names where they fit, every stop is on the map by name, and Start is in reach', async ({
    page,
  }) => {
    await open(page);
    // All thirteen, some by name and the crowded ones by number.
    await expect(page.locator('.mk:not(.off)')).toHaveCount(STOPS.length);
    expect(await page.locator('.mk:not(.off):not(.compact)').count()).toBeGreaterThan(0);
    expect(await page.locator('.mk.compact:not(.off)').count()).toBeGreaterThan(0);
    // Focused, a marker shows its name.
    const drilling = page.locator('[data-label="drilling"]');
    await drilling.locator('.mk-btn').focus();
    await expect(drilling).not.toHaveClass(/\bcompact\b/);
    // The guide's map names every stop.
    await page.getByRole('button', { name: 'Details' }).click();
    const map = page.getByRole('group', { name: /Every stop/ });
    for (const stop of STOPS) await expect(map).toContainText(stop.label);
    // In the short view over the open sheet, the markers show by number.
    await expect(page.locator('.mk:not(.off):not(.compact)')).toHaveCount(0);
    await page.getByRole('button', { name: 'Details' }).click();
    // The way in shows under the sheet's bar, with the sheet closed.
    await page.getByRole('button', { name: 'Start at the beginning' }).click();
    await expect(page.locator('.gp-panel')).toContainText('Step 1 of 4');
    await expect(page.locator('[data-label="formation"]')).not.toHaveClass(/\b(off|compact)\b/);
    await expect(page.getByRole('button', { name: 'Details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

test("the view's labels hide and show from the dock, and the stops' markers stay", async ({
  page,
}) => {
  await open(page, '&stop=city-gate');
  const parts = page.locator('.dlbl:not(.dlbl-clock):not(.off)');
  await expect(parts.first()).toBeVisible();
  const toggle = dock(page).getByRole('button', { name: 'Labels', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  // On a wide screen it says its word, as the lab's does.
  await expect(toggle.getByText('Labels', { exact: true })).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(parts).toHaveCount(0);
  // The markers are how to get around, so they stay.
  await expect(page.locator('.mk:not(.off)').first()).toBeVisible();
  await expect(page.locator('[data-label="city-gate"]')).not.toHaveClass(/\boff\b/);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(parts.first()).toBeVisible();
});

test('at the fork, → leads to the choice of path, and the keys follow the path chosen', async ({
  page,
}) => {
  await open(page, '&stop=lifting');
  await expect(guide(page)).toContainText(stopById('lifting').note?.text ?? '');
  await expect(guide(page).getByRole('button', { name: 'Natural gas path' })).toBeVisible();
  await expect(guide(page).getByRole('button', { name: 'Gasoline path' })).toBeVisible();
  // With no path chosen yet, → goes to the choice.
  await page.locator('body').press('ArrowRight');
  await expect(guide(page).getByRole('button', { name: /Natural gas path/ })).toBeFocused();
  await expect(status(page)).toHaveText(stopSummary('lifting'));
  // Down the gasoline path, ← and → step back and on along it.
  await guide(page)
    .getByRole('button', { name: /Gasoline path/ })
    .click();
  await expect(status(page)).toHaveText(stopSummary('crude-transport'));
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.keyboard.press('ArrowLeft');
  await expect(status(page)).toHaveText(stopSummary('lifting'));
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
  await guide(page).getByRole('button', { name: 'Overview', exact: true }).click();
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

test.describe('on a very narrow phone', () => {
  test.use({
    reducedMotion: 'reduce',
    viewport: { width: 300, height: 640 },
    isMobile: true,
    hasTouch: true,
  });

  test('Next says Next alone where the step bar has no room for the name, and still names it to screen readers', async ({
    page,
  }) => {
    await page.goto('utilities/gas-petroleum/?tier=low&stop=pipeline');
    await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
      timeout: 60_000,
    });
    const next = page.locator('.gp-panel').getByRole('button', {
      name: 'Next: Storage & shipping',
      exact: true,
    });
    await expect(next).toBeVisible();
    // What shows: the stop's name, hidden for want of room, isn't read by the eye.
    await expect(next).toHaveText('Next', { useInnerText: true });
  });
});

test.describe('with the guide closed beside the view', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1024, height: 768 } });

  test('the closed guide keeps its step bar on one row, Next alone, and opened, Next names its stop', async ({
    page,
  }) => {
    // A long title, and a stop whose Next would need more room than the title gives it.
    await page.goto('utilities/gas-petroleum/?tier=low&stop=gas-plant');
    await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
      timeout: 60_000,
    });
    const panel = page.locator('.gp-panel');
    await expect(panel).toHaveAttribute('data-collapsed', '');
    const next = panel.getByRole('button', { name: 'Next: Pipeline', exact: true });
    await expect(next).toHaveText('Next', { useInnerText: true });
    const back = panel.getByRole('button', { name: 'Back', exact: true });
    const [nextBox, backBox] = await Promise.all([next.boundingBox(), back.boundingBox()]);
    if (!nextBox || !backBox) throw new Error('no step bar');
    expect(Math.abs(nextBox.y - backBox.y), 'Next on the row Back is on').toBeLessThan(4);
    await panel.getByRole('button', { name: 'Open the guide' }).click();
    await expect(next).toHaveText('Next: Pipeline', { useInnerText: true });
  });
});

test.describe('with room', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

  test('Next names the stop it goes to', async ({ page }) => {
    await page.goto('utilities/gas-petroleum/?tier=low&stop=pipeline');
    await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
      timeout: 60_000,
    });
    await expect(
      page
        .locator('.gp-panel')
        .getByRole('button', { name: 'Next: Storage & shipping', exact: true }),
    ).toHaveText('Next: Storage & shipping', { useInnerText: true });
  });
});
