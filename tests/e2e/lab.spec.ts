/**
 * The lab in use: labels never flash, whether before the scene places them or while they're
 * hidden; the 3D view keeps drawing through setup and frequency changes; the signal pauses and
 * plays; the knob steps on a click; and the key finds each line in the view.
 */
import type { Locator, Page } from '@playwright/test';
import { MOTION_WAIT, countFrames, expect, isMoving, test } from './fixtures.ts';

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
          const style = getComputedStyle(el);
          // A label over the cap is in the layout, but transparent until it's focused.
          const shown =
            el.getClientRects().length > 0 &&
            style.visibility === 'visible' &&
            Number(style.opacity) > 0;
          // Out of sight: hidden, or over the cap and not focused.
          const off =
            el.classList.contains('off') ||
            (el.classList.contains('capped') && !el.matches(':focus-within'));
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

  test('pausing holds the signal still, and playing starts it again', async ({ page }) => {
    const frames = await countFrames(page);
    await open(page);
    await expect
      .poll(() => isMoving(page, frames), { message: 'the signal moves', timeout: MOTION_WAIT })
      .toBe(true);

    // Named for what it does next.
    await page.getByRole('button', { name: 'Pause the signal' }).click();
    const play = page.getByRole('button', { name: 'Play the signal' });
    await expect(play).toBeVisible();
    // The frame already asked for still lands, late when software WebGL is busy, so the view is
    // still once two whole seconds pass without a frame. Then it stays still.
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
        { message: 'paused, the view holds still', intervals: [1000] },
      )
      .toBeGreaterThanOrEqual(2);
    expect(await isMoving(page, frames), 'and stays still').toBe(false);

    await play.click();
    await expect(page.getByRole('button', { name: 'Pause the signal' })).toBeVisible();
    await expect
      .poll(() => isMoving(page, frames), {
        message: 'playing, the signal moves again',
        timeout: MOTION_WAIT,
      })
      .toBe(true);
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
      // The first frame after a change can take a while in software WebGL.
      timeout: 60_000,
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

  test('the view keeps drawing through changes', async ({ page }) => {
    // Four changes, each with a screenshot drawn in software.
    test.slow();
    await open(page);
    await exercise(page, async (step) => {
      expect(await canvasSpread(page), `${step} draws`).toBeGreaterThan(8);
    });
  });

  test('a click on the knob steps it to the next frequency, round to the first', async ({
    page,
  }) => {
    await open(page);
    const dial = page.getByRole('radiogroup', { name: 'Transmitter frequency' });
    const knob = page.locator('.dial-knob');
    for (const [name, f] of [
      ['8 kilohertz', 8000],
      ['33 kilohertz', 33000],
      ['83 kilohertz', 83000],
      ['512 hertz', 512],
    ] as const) {
      await knob.click();
      await expect(dial.getByRole('radio', { checked: true })).toHaveAccessibleName(name);
      await expect(page).toHaveURL(new RegExp(`f=${String(f)}(&|$)`));
    }
    // The detents are a radio group: End and Home jump to the ends.
    await dial.getByRole('radio', { checked: true }).focus();
    await page.keyboard.press('End');
    await expect(dial.getByRole('radio', { name: '83 kilohertz' })).toBeFocused();
    await expect(dial.getByRole('radio', { checked: true })).toHaveAccessibleName('83 kilohertz');
    await page.keyboard.press('Home');
    await expect(dial.getByRole('radio', { name: '512 hertz' })).toBeFocused();
    await expect(dial.getByRole('radio', { checked: true })).toHaveAccessibleName('512 hertz');
  });
});

test.describe('the key beside the view', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

  /** Whether the label is what's on top at its middle: in view, and under nothing. */
  function onTop(label: Locator) {
    return label.locator('.lbl-btn').evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && el.contains(hit);
    });
  }

  test("pointing at a line's row lights its label in view, and pressing it moves focus there", async ({
    page,
  }) => {
    await open(page);
    const key = page.getByRole('region', { name: 'Key' });
    for (const setup of ['Steel main', 'Plastic main']) {
      await page
        .getByRole('radiogroup', { name: 'Setup' })
        .getByRole('radio', { name: setup })
        .click();
      const rows = key.getByRole('button');
      const count = await rows.count();
      expect(count, `${setup}: a row for each line`).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const name = (await row.textContent()) ?? '';
        const label = page.locator('.lbl').filter({ has: page.getByText(name, { exact: true }) });
        await row.hover();
        await expect(label, `${setup}: ${name} lit`).toHaveClass(/\blit\b/);
        await expect(label).not.toHaveClass(/\b(off|capped|compact)\b/);
        expect(await onTop(label), `${setup}: ${name} lit, in view`).toBe(true);
        // The pointer leaving the row lets the label go.
        await page.mouse.move(700, 300);
        await expect(label).not.toHaveClass(/\blit\b/);
        await row.click();
        await expect(label.locator('.lbl-btn'), `${setup}: ${name} focused`).toBeFocused();
        expect(await onTop(label), `${setup}: ${name} focused, in view`).toBe(true);
      }
    }
  });

  test('with the guide open and less room, the key moves into the guide', async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 900 });
    await open(page);
    const key = page.getByRole('region', { name: 'Key' });
    await expect(key).toBeHidden();
    const inGuide = page.locator('.lab-panel').getByRole('button', { name: 'Key' });
    await expect(inGuide).toBeVisible();
    await expect(inGuide).toHaveAttribute('aria-expanded', 'false');
    // Closed down to its title, the guide leaves room for the key beside the view again.
    await page.getByRole('button', { name: 'Close the lab guide' }).click();
    await expect(key).toBeVisible();
  });
});

test.describe('on a phone', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });

  test('every label is reachable by keyboard, and shows with its definition, clear of the controls', async ({
    page,
  }) => {
    await open(page);
    for (const setup of ['Plastic main', 'Steel main']) {
      await page
        .getByRole('radiogroup', { name: 'Setup' })
        .getByRole('radio', { name: setup })
        .click();
      const ids = await page
        .locator('.lbl:not([hidden])')
        .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.label ?? ''));
      // A phone shows only a few labels at once; the rest wait, out of sight, for focus.
      await page.locator('.lbl:not([hidden]) .lbl-btn').first().focus();
      const reached: string[] = [];
      for (let i = 0; i < ids.length; i++) {
        if (i > 0) await page.keyboard.press('Tab');
        const id = await page.evaluate(
          () => document.activeElement?.closest<HTMLElement>('.lbl')?.dataset.label ?? '',
        );
        expect(id, `${setup}: tab ${String(i)} lands on a label`).not.toBe('');
        reached.push(id);
        const label = page.locator(`[data-label="${id}"]`);
        await expect(label, `${setup}: ${id} shows`).not.toHaveClass(/\b(off|capped)\b/);
        await expect(label).toHaveCSS('opacity', '1');
        // The label and its definition both show in full, clear of every control.
        const chrome = await page.$$eval('[data-chrome]', (els) =>
          els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0),
        );
        const tip = label.getByRole('tooltip');
        await expect(tip, `${setup}: ${id} definition`).toBeVisible();
        for (const [part, locator] of [
          ['label', label.locator('.lbl-btn')],
          ['definition', tip],
        ] as const) {
          const box = await locator.boundingBox();
          expect(box, `${setup}: ${id} ${part} has a box`).not.toBeNull();
          if (!box) continue;
          const at = `${setup}: ${id} ${part}`;
          expect(box.x, at).toBeGreaterThanOrEqual(0);
          expect(box.y, at).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, at).toBeLessThanOrEqual(390);
          expect(box.y + box.height, at).toBeLessThanOrEqual(844);
          for (const c of chrome) {
            const under =
              box.x < c.right &&
              box.x + box.width > c.left &&
              box.y < c.bottom &&
              box.y + box.height > c.top;
            expect(under, `${at} under a control`).toBe(false);
          }
        }
      }
      expect([...reached].sort()).toEqual([...ids].sort());
    }
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
