import { test as base, expect, type Page } from '@playwright/test';

/** Waits until a 3D page's view is built and drawing. */
export async function waitReady(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
}

type Counted = Window & { drawnFrames?: number; frameTimes?: number[] };

/**
 * Counts the frames a 3D view draws, from before the page loads, and returns a reader of the count;
 * it notes when the last few began, too, for `waitStill`. The view's loop sleeps whenever nothing
 * moves, so the count holds still exactly when the view does. (Screenshots of a moving canvas are
 * too slow under software WebGL to compare instead.)
 */
export async function countFrames(page: Page): Promise<() => Promise<number>> {
  await page.addInitScript(() => {
    const w = window as Counted;
    w.drawnFrames = 0;
    w.frameTimes = [];
    let inFrame = false;
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
        // A frame's draws all come in one task: its first draw starts the frame, its task ends it.
        if (!inFrame) {
          inFrame = true;
          w.drawnFrames = (w.drawnFrames ?? 0) + 1;
          w.frameTimes = [...(w.frameTimes ?? []), performance.now()].slice(-5);
          setTimeout(() => {
            inFrame = false;
          }, 0);
        }
        Reflect.apply(draw, this, args);
      });
    }
  });
  return () => page.evaluate(() => (window as Counted).drawnFrames ?? 0);
}

/**
 * Whether a view is moving: drawing frame after frame over the given time. A single frame isn't
 * motion: one asked for before a pause can land late when software WebGL is busy. The window is
 * long enough for two frames even when software WebGL, starved by other tests, draws under one a
 * second.
 */
export async function isMoving(
  page: Page,
  frames: () => Promise<number>,
  ms = 3000,
): Promise<boolean> {
  const before = await frames();
  await page.waitForTimeout(ms);
  return (await frames()) - before >= 2;
}

/**
 * How long to wait for a view to show motion it should have: software WebGL, sharing the machine
 * with other tests, can take many seconds to draw again after a change.
 */
export const MOTION_WAIT = 45_000;

/**
 * Waits until a view whose frames `countFrames` counts is still: it has drawn nothing for two
 * seconds, or for three times the longest gap between its last few frames if that's longer. Software
 * WebGL starved by other tests can take seconds over one frame of a move that's still settling, and
 * that gap alone isn't stillness. Check `isMoving` after, to see it stays still.
 */
export async function waitStill(page: Page, message: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const times = (window as Counted).frameTimes ?? [];
          const gaps = times.slice(1).map((t, i) => t - (times[i] ?? t));
          const quiet = Math.max(2000, 3 * Math.max(0, ...gaps));
          return performance.now() - (times.at(-1) ?? 0) > quiet;
        }),
      { message, intervals: [500], timeout: MOTION_WAIT },
    )
    .toBe(true);
}

/**
 * The names drawn in a 3D view, at their size: its labels' names, and the diorama's on its stops'
 * parts (not the time-lapse's clock). A name kept for screen readers, clipped to a pixel, isn't
 * drawn.
 */
export function shownNames(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '.labels .lbl-text, .details .dlbl:not(.dlbl-clock)',
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 2 &&
          r.height > 2 &&
          getComputedStyle(el).clipPath === 'none' &&
          el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
        );
      })
      .map((el) => el.textContent.trim()),
  );
}

/**
 * Loads every image the portal shows, so none is blank when it's checked or captured: its lazy
 * previews, below the fold, and its hero's still, a CSS background.
 */
export async function loadImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = 'eager';
    const hero = document.querySelector('.hero-image');
    const url = hero
      ? /url\("?([^")]+)"?\)/.exec(getComputedStyle(hero).backgroundImage)?.[1]
      : null;
    const still = url ? Object.assign(new Image(), { src: url }) : null;
    await Promise.all([...document.images, ...(still ? [still] : [])].map((img) => img.decode()));
  });
}

interface Problems {
  /**
   * Pages this test means to open at a missing address: the site's 404 page answers there, with a
   * 404 status that's expected, not a broken link.
   */
  expectNotFound: boolean;
}

/**
 * Every test fails on any console error or warning, uncaught page error, failed request, request
 * to another origin (no CDNs), or page that loads as an error.
 */
export const test = base.extend<Problems>({
  expectNotFound: [false, { option: true }],
  page: async ({ page, expectNotFound, baseURL }, use) => {
    const problems: string[] = [];
    const origin = new URL(baseURL ?? 'http://localhost').origin;
    page.on('console', (msg) => {
      // The browser notes a 404 page's status in the console; that's the page meant here.
      const notFoundNote =
        expectNotFound && msg.text().includes('the server responded with a status of 404');
      if ((msg.type() === 'error' || msg.type() === 'warning') && !notFoundNote) {
        problems.push(`console.${msg.type()}: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    page.on('requestfailed', (req) => {
      problems.push(`request failed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`);
    });
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.protocol === 'data:' || url.protocol === 'blob:') return;
      if (url.origin !== origin) {
        problems.push(`cross-origin request: ${req.url()}`);
      }
    });
    // A link to a page that isn't there loads an error page, not a failed request.
    page.on('response', (res) => {
      if (res.status() < 400) return;
      if (!res.request().isNavigationRequest()) {
        // A missing file, even on a 404 page, is a real problem.
        problems.push(`missing file: ${res.url()} (${String(res.status())})`);
        return;
      }
      if (expectNotFound && res.status() === 404) return;
      problems.push(`page not found: ${res.url()} (${String(res.status())})`);
    });
    await use(page);
    expect(problems, 'console, page errors and requests').toEqual([]);
  },
});

export { expect };
