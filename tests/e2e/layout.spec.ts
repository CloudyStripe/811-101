/**
 * The layout between and beyond the two designed sizes: tablets, phones held sideways or with
 * browser toolbars showing, small and zoomed laptop windows, and a 1280×1024 screen zoomed to 400%
 * (320×256, WCAG 1.4.10). Every control must be reachable and on top where it's clicked, the
 * frequency buttons on screen without scrolling, the hookup framed clear of the controls, the
 * guide never over the lines, and no chrome overlapping. On phones held sideways, the settings
 * menu fits under its button.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

interface Size {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  /** The transmitter and stake labels show. */
  framed: boolean;
  /** Everything fits without scrolling. */
  fits: boolean;
  /**
   * With the guide open, the frequency buttons stay on screen too. On short screens they step
   * aside for it, and on short phones the page scrolls down to it.
   */
  roomy: boolean;
  /** With the guide open, the view keeps room enough to label the gas main above it. */
  guideRoom?: boolean;
}

const SIZES: Size[] = [
  {
    name: 'tablet-portrait',
    width: 820,
    height: 1180,
    touch: true,
    framed: true,
    fits: true,
    roomy: true,
    guideRoom: true,
  },
  {
    name: 'large-tablet-portrait',
    width: 1024,
    height: 1366,
    touch: true,
    framed: true,
    fits: true,
    roomy: true,
    guideRoom: true,
  },
  {
    name: 'tablet-landscape',
    width: 1112,
    height: 834,
    touch: true,
    framed: true,
    fits: true,
    roomy: true,
    guideRoom: true,
  },
  {
    name: 'small-laptop',
    width: 1024,
    height: 768,
    touch: false,
    framed: true,
    fits: true,
    roomy: true,
    guideRoom: true,
  },
  {
    name: 'small-window',
    width: 900,
    height: 600,
    touch: false,
    framed: true,
    fits: true,
    roomy: true,
  },
  {
    name: 'narrow-window',
    width: 761,
    height: 900,
    touch: false,
    framed: true,
    fits: true,
    roomy: true,
    guideRoom: true,
  },
  // A 1366 × 768 laptop at 125% zoom, with browser toolbars.
  {
    name: 'zoomed-laptop',
    width: 1093,
    height: 505,
    touch: false,
    framed: true,
    fits: true,
    roomy: false,
  },
  {
    name: 'short-window',
    width: 740,
    height: 560,
    touch: false,
    framed: true,
    fits: true,
    roomy: false,
  },
  // A small phone with the browser's toolbars showing.
  {
    name: 'small-phone',
    width: 375,
    height: 553,
    touch: true,
    framed: true,
    fits: true,
    roomy: false,
  },
  {
    name: 'phone-landscape',
    width: 844,
    height: 390,
    touch: true,
    framed: true,
    fits: true,
    roomy: false,
  },
  {
    name: 'small-phone-landscape',
    width: 667,
    height: 375,
    touch: true,
    framed: true,
    fits: true,
    roomy: false,
  },
  // The smallest sideways phone: everything fits, but the view is too small to frame the hookup.
  {
    name: 'tiny-phone-landscape',
    width: 568,
    height: 320,
    touch: true,
    framed: false,
    fits: true,
    roomy: false,
  },
  // 1280 × 1024 at 400%: a reflow check. The page scrolls to reach everything.
  {
    name: 'zoomed-400',
    width: 320,
    height: 256,
    touch: false,
    framed: false,
    fits: false,
    roomy: false,
  },
];

async function open(page: Page) {
  await page.goto('training/frequency-lab/?tier=low');
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
}

/** Whether the control is what's actually on top at its center, after scrolling it into view. */
async function onTop(page: Page, selector: string, index: number) {
  const control = page.locator(selector).nth(index);
  await control.scrollIntoViewIfNeeded();
  return control.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && (hit === el || el.contains(hit));
  });
}

/** Asserts the frequency buttons are on screen, and the page fits them without scrolling. */
async function expectFrequencyOnScreen(page: Page, height: number, when: string) {
  const overflow = await page.evaluate(
    () => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
  );
  expect(overflow, `page taller than the screen ${when}`).toBeLessThanOrEqual(1);
  for (const name of ['512 hertz', '83 kilohertz']) {
    const box = await page.getByRole('radio', { name }).boundingBox();
    expect(box, `${name} ${when}`).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0), `${name} bottom ${when}`).toBeLessThanOrEqual(
      height,
    );
  }
}

test.use({ reducedMotion: 'reduce' });

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch,
    });

    test('controls reachable and on screen, hookup framed, no chrome overlapping', async ({
      page,
    }) => {
      await open(page);
      await page.screenshot({ path: `artifacts/screenshots/layout-${size.name}.png` });
      if (size.fits) await expectFrequencyOnScreen(page, size.height, 'with the guide closed');

      // The hookup, where the lesson starts, is framed clear of the controls.
      if (size.framed) {
        for (const id of ['transmitter', 'stake']) {
          await expect(page.locator(`[data-label="${id}"]`), `${id} label`).not.toHaveClass(
            /\b(off|capped)\b/,
          );
        }
      }

      // The guide opens between the view and the console, never over the lines, and closes.
      if (size.fits) {
        const guide = page
          .getByRole('region', { name: 'Controls' })
          .getByRole('button', { name: 'Guide', exact: true });
        await guide.click();
        await expect(page.getByRole('heading', { name: "What's happening" })).toBeVisible();
        await page.screenshot({ path: `artifacts/screenshots/layout-${size.name}-guide.png` });
        if (size.roomy) await expectFrequencyOnScreen(page, size.height, 'with the guide open');
        const target = page.locator('[data-label="target"]');
        if (size.guideRoom) await expect(target).not.toHaveClass(/\b(off|capped)\b/);
        // Shown, the main's label is never under the guide; over the cap, focusing it shows it,
        // clear of the guide too.
        const underGuide = async () => {
          const label = await target.locator('.lbl-btn').boundingBox();
          const drawer = await page.locator('#lab-drawer').boundingBox();
          return (
            label !== null &&
            drawer !== null &&
            label.x < drawer.x + drawer.width &&
            label.x + label.width > drawer.x &&
            label.y < drawer.y + drawer.height &&
            label.y + label.height > drawer.y
          );
        };
        const state = await target.getAttribute('class');
        if (!/\boff\b/.test(state ?? '')) {
          if (!/\bcapped\b/.test(state ?? '')) {
            expect(await underGuide(), 'the main under the guide').toBe(false);
          }
          await target.locator('.lbl-btn').focus();
          await expect(target).not.toHaveClass(/\bcapped\b/);
          expect(await underGuide(), 'the main, focused, under the guide').toBe(false);
          await target.locator('.lbl-btn').blur();
        }
        await page.getByRole('button', { name: 'Close the lab guide' }).click();
        await expect(page.locator('#lab-drawer')).toBeHidden();
      }

      // The lab's own controls; the header's settings menu is closed, so its choices are hidden.
      const radios = '.lab-grid [role="radio"]';
      const count = await page.locator(radios).count();
      for (let i = 0; i < count; i++) {
        expect(await onTop(page, radios, i), `radio #${String(i)} is covered`).toBe(true);
      }

      // Clicking the last frequency works even when the page had to scroll to it.
      await page.getByRole('radio', { name: '83 kilohertz' }).click();
      await expect(page.getByRole('radio', { name: '83 kilohertz' })).toHaveAttribute(
        'aria-checked',
        'true',
      );

      const chrome = await page.$$eval('[data-chrome]', (els) =>
        els.flatMap((e) => {
          const r = e.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return [];
          return [{ id: e.getAttribute('class') ?? '', x: r.x, y: r.y, w: r.width, h: r.height }];
        }),
      );
      chrome.forEach((a, i) => {
        for (const b of chrome.slice(i + 1)) {
          const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
          expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
        }
      });
    });
  });
}

test.describe('rotating a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('turns the block between its view from the hookup end and the view from in front', async ({
    page,
  }) => {
    await open(page);
    const stage = page.locator('.stage');
    await expect(stage).toHaveAttribute('data-view', 'tall');
    const guide = page
      .getByRole('region', { name: 'Controls' })
      .getByRole('button', { name: 'Guide', exact: true });
    for (const [width, height, view] of [
      [844, 390, 'wide'],
      [390, 844, 'tall'],
    ] as const) {
      // Turned with the guide open, then closed: the view is framed again each time.
      await guide.click();
      await page.setViewportSize({ width, height });
      await expect(stage).toHaveAttribute('data-view', view);
      await guide.click();
      for (const id of ['transmitter', 'target']) {
        await expect(
          page.locator(`[data-label="${id}"]`),
          `${id} label at ${String(width)}×${String(height)}`,
        ).not.toHaveClass(/\b(off|capped)\b/);
      }
    }
  });
});

/** The settings menu on phones held sideways: all of it under its button, nothing to scroll to. */
for (const size of SIZES.filter((s) =>
  ['phone-landscape', 'small-phone-landscape', 'tiny-phone-landscape'].includes(s.name),
)) {
  test.describe(`settings ${size.name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: true,
      isMobile: true,
    });

    test('the settings menu shows every line, with nothing to scroll', async ({ page }) => {
      await page.goto('./');
      await page.getByRole('button', { name: 'Settings' }).tap();
      const menu = page.getByRole('dialog', { name: 'Settings' });
      await expect(menu).toBeVisible();
      const fit = await menu.evaluate((m) => ({
        hidden: m.scrollHeight - m.clientHeight,
        bottom: m.getBoundingClientRect().bottom,
      }));
      expect(fit.hidden, 'left to scroll to').toBeLessThanOrEqual(1);
      expect(fit.bottom).toBeLessThanOrEqual(size.height);
      await expect(menu.getByText('Saved in this browser')).toBeInViewport({ ratio: 1 });
      for (const name of ['Dark', 'Reduced', 'High']) {
        await expect(menu.getByRole('radio', { name })).toBeInViewport({ ratio: 1 });
      }
    });
  });
}

/** Every piece of the diorama's chrome that shows sits clear of every other. */
async function expectChromeApart(page: Page) {
  const chrome = await page.$$eval('[data-chrome]', (els) =>
    els.flatMap((e) => {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || !e.checkVisibility({ visibilityProperty: true })) {
        return [];
      }
      return [{ id: e.getAttribute('class') ?? '', x: r.x, y: r.y, w: r.width, h: r.height }];
    }),
  );
  chrome.forEach((a, i) => {
    for (const b of chrome.slice(i + 1)) {
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
    }
  });
}

/**
 * The step bar's parts, each in its own room inside the bar: side by side, or where the guide is
 * narrow, its way on in a row of its own; never one over another, nor the strip spilling out.
 */
async function expectStepBarFits(page: Page, at: string) {
  const bars = await page.$$eval('.stepbar', (els) =>
    els
      .filter((bar) => bar.checkVisibility())
      .map((bar) => {
        const box = (e: Element) => {
          const r = e.getBoundingClientRect();
          return { id: e.className || e.tagName, x: r.x, y: r.y, w: r.width, h: r.height };
        };
        const where = bar.querySelector('.stepbar-where');
        const strip = bar.querySelector('.stepbar-strip');
        return {
          bar: box(bar),
          parts: [...bar.children].map(box),
          where: where ? box(where) : null,
          strip: strip ? box(strip) : null,
        };
      }),
  );
  const holds = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    b.x >= a.x - 0.5 &&
    b.y >= a.y - 0.5 &&
    b.x + b.w <= a.x + a.w + 0.5 &&
    b.y + b.h <= a.y + a.h + 0.5;
  for (const { bar, parts, where, strip } of bars) {
    parts.forEach((a, i) => {
      expect(holds(bar, a), `${at}: ${a.id} inside the step bar`).toBe(true);
      for (const b of parts.slice(i + 1)) {
        const over = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        expect(over, `${at}: ${a.id} over ${b.id}`).toBe(false);
      }
    });
    if (where && strip) expect(holds(where, strip), `${at}: the strip in its place`).toBe(true);
  }
}

/** The diorama at a few of the same sizes: its controls on screen and on top, none overlapping. */
for (const size of SIZES.filter((s) =>
  [
    'tablet-portrait',
    'small-laptop',
    'small-window',
    'small-phone',
    'phone-landscape',
    'small-phone-landscape',
    'tiny-phone-landscape',
  ].includes(s.name),
)) {
  test.describe(`diorama ${size.name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch,
    });

    test('controls on screen and on top, none overlapping', async ({ page }) => {
      await page.goto('utilities/gas-petroleum/?tier=low&stop=lifting');
      await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
        timeout: 60_000,
      });
      await page.screenshot({ path: `artifacts/screenshots/layout-diorama-${size.name}.png` });
      const overflow = await page.evaluate(
        () => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
      );
      expect(overflow, 'page taller than the screen').toBeLessThanOrEqual(1);
      const controls =
        '.gp-dock button, .gp-dock [role="radio"], .gp-camera button, .gp-panel .sheet-toggle, .stepbar button';
      const count = await page.locator(controls).count();
      for (let i = 0; i < count; i++) {
        if (!(await page.locator(controls).nth(i).isVisible())) continue;
        expect(await onTop(page, controls, i), `control #${String(i)} is covered`).toBe(true);
      }
      await expectChromeApart(page);
      // The path switch keeps each of its names to one line.
      for (const option of await page.locator('.gp-dock [role="radio"]').all()) {
        const name = await option.innerText();
        expect((await option.boundingBox())?.height ?? 0, `${name} on one line`).toBeLessThan(40);
      }
      await expectStepBarFits(page, 'at the fork');
      // Beside the view, the guide opened (it starts closed below 1280 px): the step bar, at the
      // guide's narrowest, still fits.
      const openGuide = page.getByRole('button', { name: 'Open the guide' });
      if (await openGuide.isVisible()) {
        await openGuide.click();
        await expect(page.locator('.gp-grid')).toHaveAttribute('data-panel', 'open');
        await expectChromeApart(page);
        await expectStepBarFits(page, 'the guide open at the fork');
        await page.locator('.gp-panel').getByRole('button', { name: 'Choose a path' }).click();
        await page
          .locator('.gp-panel')
          .getByRole('button', { name: /Natural gas path/ })
          .click();
        await expect(page.locator('.gp-panel')).toContainText('Step 5 of 9');
        await expectChromeApart(page);
        await expectStepBarFits(page, 'the guide open on the natural gas path');
      }
      // With the sheet open: where it covers the view, the camera's buttons go out of sight and
      // reach with it; wherever it opens, nothing that shows sits over anything else.
      const toggle = page.locator('.gp-panel .sheet-toggle');
      if (await toggle.isVisible()) {
        await toggle.click();
        await expect(page.locator('.gp-grid')).toHaveAttribute('data-sheet', 'open');
        if ((await page.locator('main.stage').getAttribute('inert')) !== null) {
          await expect(page.locator('.gp-camera')).toBeHidden();
          await expect(page.locator('.gp-camera')).toHaveAttribute('inert', '');
        }
        await expectChromeApart(page);
      }
    });
  });
}

/**
 * The rows of the view, between the header and the console, that the block takes: with the page's
 * chrome and labels hidden, a row is the block's where enough of it differs from the sky at its
 * left edge, which is sky at every size.
 */
async function blockRows(page: Page) {
  const free = await page.evaluate(() => {
    const top = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
    const below = document.querySelector('.lab-console')?.getBoundingClientRect().top;
    return { top, bottom: (below ?? innerHeight) - 8 };
  });
  const png = await page.screenshot({
    style: '.labels, .site-header, .lab-console { visibility: hidden !important; }',
  });
  const rows = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0);
    const { data: px, width, height } = ctx.getImageData(0, 0, img.width, img.height);
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
      const edge = y * width * 4;
      let block = 0;
      for (let x = 0; x < width; x += 3) {
        const i = (y * width + x) * 4;
        const differs =
          Math.abs((px[i] ?? 0) - (px[edge] ?? 0)) +
          Math.abs((px[i + 1] ?? 0) - (px[edge + 1] ?? 0)) +
          Math.abs((px[i + 2] ?? 0) - (px[edge + 2] ?? 0));
        if (differs > 40) block++;
      }
      if (block > width / 60) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    return { top, bottom };
  }, png.toString('base64'));
  return { free, rows };
}

test.describe('the block fills its room', () => {
  for (const size of [
    { name: 'desktop', width: 1440, height: 900, touch: false },
    { name: 'phone', width: 390, height: 844, touch: true },
    { name: '4:3 monitor', width: 1280, height: 1024, touch: false },
  ]) {
    test.describe(size.name, () => {
      test.use({
        viewport: { width: size.width, height: size.height },
        hasTouch: size.touch,
        isMobile: size.touch,
        reducedMotion: 'reduce',
      });

      test('between the header and the console, with no band of sky above or under it', async ({
        page,
      }) => {
        await page.goto('training/frequency-lab/?tier=low&capture');
        await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
          timeout: 60_000,
        });
        const { free, rows } = await blockRows(page);
        const room = free.bottom - free.top;
        expect(rows.top, 'the block shows').toBeGreaterThan(0);
        expect((rows.top - free.top) / room, 'sky above').toBeLessThan(0.08);
        expect((free.bottom - rows.bottom) / room, 'sky under').toBeLessThan(0.07);
      });
    });
  }
});

test.describe('the block is built again for its room', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('shallower over an open drawer, deep again once it closes, and deeper for a squarer window', async ({
    page,
  }) => {
    await page.goto('training/frequency-lab/?tier=low');
    await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
      timeout: 60_000,
    });
    const stage = page.locator('.stage');
    const depth = async () => Number(await stage.getAttribute('data-depth'));
    const closed = await depth();
    expect(closed).toBeGreaterThan(0);
    const guide = page
      .getByRole('region', { name: 'Controls' })
      .getByRole('button', { name: 'Guide', exact: true });
    await guide.click();
    await expect.poll(depth).toBeLessThan(closed);
    await page.getByRole('button', { name: 'Close the lab guide' }).click();
    await expect.poll(depth).toBe(closed);
    // Resized squarer, it's built deeper once the window holds still, and fills its room again.
    await page.setViewportSize({ width: 1280, height: 1024 });
    await expect.poll(depth, { timeout: 15_000 }).toBeGreaterThan(closed);
    const { free, rows } = await blockRows(page);
    const room = free.bottom - free.top;
    expect((rows.top - free.top) / room, 'sky above').toBeLessThan(0.08);
    expect((free.bottom - rows.bottom) / room, 'sky under').toBeLessThan(0.07);
  });
});
