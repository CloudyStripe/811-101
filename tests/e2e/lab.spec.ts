/**
 * The lab in use: labels never flash, whether before the scene places them or while they're
 * hidden, and the 3D view keeps drawing through setup and frequency changes.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

type Watched = Window & { labelProblems?: string[] };

/** Switches to the plastic main, steps the dial through every frequency, and switches back. */
async function exercise(page: Page, afterEach: (step: string) => Promise<void>) {
  const setup = page.getByRole('radiogroup', { name: 'Setup' });
  const tracer = page.locator('[data-label="tracer"]');
  await expect(tracer).toBeHidden();
  await afterEach('steel at 512 Hz');

  await setup.getByRole('radio', { name: 'Plastic main' }).click();
  await expect(page).toHaveURL(/setup=plastic/);
  await expect(tracer).toBeVisible();
  await expect(page.locator('[data-label="target"] .lbl-text')).toHaveText('Plastic gas main');
  await afterEach('plastic at 512 Hz');

  const dial = page.getByRole('radiogroup', { name: 'Transmitter frequency' });
  await dial.getByRole('radio', { checked: true }).focus();
  for (const f of [8000, 33000, 83000]) {
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(new RegExp(`f=${String(f)}(&|$)`));
  }
  await afterEach('plastic at 83 kHz');

  await setup.getByRole('radio', { name: 'Steel main' }).click();
  await expect(page).toHaveURL(/setup=steel/);
  await expect(tracer).toBeHidden();
  await afterEach('steel at 83 kHz');
}

async function open(page: Page) {
  await page.goto('training/frequency-lab/?tier=low');
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
}

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('labels never flash', async ({ page }) => {
    // Every frame, look for a label that's visible before the scene has placed it, or that
    // reappears while it's meant to be hidden.
    await page.addInitScript(() => {
      const w = window as Watched;
      const problems: string[] = [];
      w.labelProblems = problems;
      const last = new Map<string, { shown: boolean; off: boolean }>();
      const check = () => {
        for (const el of document.querySelectorAll<HTMLElement>('.lbl')) {
          const id = el.dataset.label ?? '?';
          const shown =
            el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible';
          const off = el.classList.contains('off');
          const was = last.get(id);
          if (shown && el.style.transform === '') problems.push(`${id} shown before placed`);
          if (shown && off && was?.off && !was.shown) problems.push(`${id} flashed while hidden`);
          last.set(id, { shown, off });
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    await open(page);
    await exercise(page, async () => {
      // A few frames for labels to settle after each change.
      await page.waitForTimeout(400);
    });
    const problems = await page.evaluate(() => (window as Watched).labelProblems ?? []);
    expect([...new Set(problems)]).toEqual([]);
  });
});

test.describe('with reduced motion', () => {
  // The loop sleeps between changes, so screenshots are quick even with software WebGL.
  test.use({ reducedMotion: 'reduce' });

  /** Spread of brightness across the 3D view alone. A blank or cleared canvas is close to 0. */
  async function canvasSpread(page: Page): Promise<number> {
    const png = await page.locator('canvas').screenshot({
      // Everything over the canvas is hidden, so only the 3D view itself is measured.
      style: '.labels, [data-chrome] { visibility: hidden !important; }',
    });
    return page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
      if (!ctx) return 0;
      ctx.drawImage(bitmap, 0, 0);
      const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      // Every fourth pixel is plenty.
      for (let i = 0; i + 2 < data.length; i += 16) {
        const y =
          0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
        sum += y;
        sumSq += y * y;
        n += 1;
      }
      const mean = sum / n;
      return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
    }, png.toString('base64'));
  }

  test('dragging and zooming move the view even though nothing animates', async ({ page }) => {
    await open(page);
    const label = page.locator('[data-label="transmitter"]');
    const placeOf = () => label.evaluate((el) => el.style.transform);
    const box = await page.locator('canvas').boundingBox();
    if (!box) throw new Error('no canvas');

    // Drag across the view: the camera turns, so the label moves.
    const before = await placeOf();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5, { steps: 8 });
    await page.mouse.up();
    await expect.poll(placeOf).not.toBe(before);

    // Scroll to zoom: it moves too.
    const afterDrag = await placeOf();
    await page.mouse.wheel(0, -400);
    await expect.poll(placeOf).not.toBe(afterDrag);
  });

  test('the view keeps drawing through changes', async ({ page }) => {
    await open(page);
    await exercise(page, async (step) => {
      expect(await canvasSpread(page), `${step} draws`).toBeGreaterThan(8);
    });
  });
});

test.describe('losing the graphics context', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const size of [
    { width: 1024, height: 768 },
    { width: 844, height: 390 },
  ]) {
    test(`at ${String(size.width)}×${String(size.height)}: a clear message, then a clean recovery`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await open(page);
      await page.evaluate(() => {
        const ext = document
          .querySelector('canvas')
          ?.getContext('webgl2')
          ?.getExtension('WEBGL_lose_context');
        (window as Window & { restoreGl?: () => void }).restoreGl = () => ext?.restoreContext();
        ext?.loseContext();
      });

      // The message sits in the view's free area, clear of every control.
      const message = page.locator('.stage-message');
      await expect(message).toBeVisible();
      const box = await message.boundingBox();
      const chrome = await page.$$eval('[data-chrome]', (els) =>
        els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0),
      );
      for (const c of chrome) {
        const overlap =
          box !== null &&
          box.x < c.right &&
          box.x + box.width > c.left &&
          box.y < c.bottom &&
          box.y + box.height > c.top;
        expect(overlap, 'message under a control').toBe(false);
      }

      // Recovery clears the message; the fixture fails the test on any warning it logs.
      await page.evaluate(() => {
        (window as Window & { restoreGl?: () => void }).restoreGl?.();
      });
      await expect(message).toBeHidden();
      await expect(page.locator('[data-label="transmitter"]')).not.toHaveClass(/\boff\b/);
    });
  }
});
