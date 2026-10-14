/**
 * Screenshots for review, at desktop and phone sizes, in light and dark: the portal, every
 * listed state of the lab, and the diorama. The lab is captured in `?capture` mode (fixed time
 * and tier, one settled frame) so it's deterministic, and each lab capture also checks that
 * labels are neither clipped nor overlapping each other or the chrome.
 */
import type { Page } from '@playwright/test';
import { DIORAMA_HOSTS, type DioramaWindow, expect, openDiorama, test } from './fixtures.ts';

interface State {
  name: string;
  query: string;
  /** Anything to open before the screenshot. */
  prepare?: (page: Page, phone: boolean) => Promise<void>;
  phoneOnly?: boolean;
  desktopOnly?: boolean;
}

async function openSheet(page: Page) {
  await page.getByRole('button', { name: 'Details' }).click();
}

const STATES: State[] = [
  { name: 'steel-512', query: 'setup=steel&f=512' },
  { name: 'steel-83k', query: 'setup=steel&f=83000' },
  { name: 'plastic-512', query: 'setup=plastic&f=512' },
  { name: 'plastic-83k', query: 'setup=plastic&f=83000' },
  {
    name: 'about',
    query: 'setup=steel&f=33000',
    prepare: async (page, phone) => {
      if (phone) await openSheet(page);
      await page.getByRole('button', { name: 'About this model' }).click();
      await expect(page.getByRole('dialog', { name: 'About this model' })).toBeVisible();
    },
  },
  {
    name: 'guide-closed',
    query: 'setup=steel&f=83000',
    desktopOnly: true,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Close the lab guide' }).click();
      await expect(page.getByRole('button', { name: 'Open the lab guide' })).toBeVisible();
    },
  },
  {
    name: 'sheet',
    query: 'setup=plastic&f=33000',
    phoneOnly: true,
    prepare: async (page) => {
      await openSheet(page);
      await expect(page.getByRole('heading', { name: "What's happening" })).toBeVisible();
    },
  },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, scale: 1, tier: 'high' },
  { name: 'phone', width: 390, height: 844, scale: 2, tier: 'medium' },
] as const;

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function boxesOf(page: Page, selector: string): Promise<Box[]> {
  return page.$$eval(selector, (els) =>
    els.flatMap((e) => {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return [];
      const id = (e as HTMLElement).dataset.label ?? e.getAttribute('class') ?? '';
      return [{ id, x: r.x, y: r.y, w: r.width, h: r.height }];
    }),
  );
}

for (const theme of ['light', 'dark'] as const) {
  for (const vp of VIEWPORTS) {
    const phone = vp.name === 'phone';
    test.describe(`${vp.name} ${theme}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.scale,
        colorScheme: theme,
        hasTouch: phone,
        isMobile: phone,
      });
      for (const s of STATES.filter((st) => (phone ? !st.desktopOnly : !st.phoneOnly))) {
        test(s.name, async ({ page }) => {
          await page.goto(`training/frequency-lab/?${s.query}&tier=${vp.tier}&capture`);
          await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
            timeout: 60_000,
          });
          await s.prepare?.(page, phone);
          await page.screenshot({
            path: `artifacts/screenshots/${theme}-${vp.name}-${s.name}.png`,
            // Labels fade in once placed; settle the fade so it isn't caught halfway.
            animations: 'disabled',
          });

          // No clipped or overlapping labels among those showing (not out of sight or capped).
          const labels = await boxesOf(page, '.lbl:not(.off):not(.capped):not([hidden])');
          for (const b of labels) {
            expect(b.x, `${b.id} clipped left`).toBeGreaterThanOrEqual(0);
            expect(b.y, `${b.id} clipped top`).toBeGreaterThanOrEqual(0);
            expect(b.x + b.w, `${b.id} clipped right`).toBeLessThanOrEqual(vp.width);
            expect(b.y + b.h, `${b.id} clipped bottom`).toBeLessThanOrEqual(vp.height);
          }
          labels.forEach((a, i) => {
            for (const b of labels.slice(i + 1)) {
              expect(overlaps(a, b), `${a.id} overlaps ${b.id}`).toBe(false);
            }
          });
          // Nor under the chrome, unless something was opened over the view since.
          if (!s.prepare) {
            const chrome = await boxesOf(page, '[data-chrome]');
            for (const a of labels) {
              for (const c of chrome) expect(overlaps(a, c), `${a.id} under ${c.id}`).toBe(false);
            }
          }
        });
      }
    });
  }
}

for (const theme of ['light', 'dark'] as const) {
  for (const vp of VIEWPORTS) {
    test.describe(`portal ${vp.name} ${theme}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.scale,
        colorScheme: theme,
        hasTouch: vp.name === 'phone',
        isMobile: vp.name === 'phone',
      });

      test('the whole page', async ({ page }) => {
        await page.goto('./');
        // Every preview decoded, so none is captured blank.
        await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
        await page.screenshot({
          path: `artifacts/screenshots/portal-${theme}-${vp.name}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      });
    });
  }
}

/** Waits until the diorama's camera has stopped moving; the page must be opened with #debug. */
async function dioramaCameraAtRest(page: Page) {
  let last = '';
  let still = 0;
  await expect
    .poll(
      async () => {
        const now = await page.evaluate(() => {
          const p = (window as DioramaWindow).__app?.camera.position;
          return p ? [p.x, p.y, p.z].map((v) => v.toFixed(3)).join(',') : '';
        });
        still = now !== '' && now === last ? still + 1 : 0;
        last = now;
        return still;
      },
      { message: 'the camera comes to rest', intervals: [200], timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(3);
}

for (const theme of ['light', 'dark'] as const) {
  for (const vp of VIEWPORTS) {
    test.describe(`diorama ${vp.name} ${theme}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.scale,
        colorScheme: theme,
        hasTouch: vp.name === 'phone',
        isMobile: vp.name === 'phone',
        reducedMotion: 'reduce',
        allowHosts: DIORAMA_HOSTS,
      });

      test('the overview and the city gate', async ({ page }) => {
        await openDiorama(page, '#debug');
        await dioramaCameraAtRest(page);
        await page.screenshot({
          path: `artifacts/screenshots/diorama-${theme}-${vp.name}-overview.png`,
          animations: 'disabled',
        });
        // The route map's dot; the 3D view's label for the stop has the same name.
        await page.locator('.rmap .st[data-id="city-gate"]').click();
        await expect(page.locator('#p-title')).toHaveText('Into town: lower pressure, added smell');
        await dioramaCameraAtRest(page);
        await page.screenshot({
          path: `artifacts/screenshots/diorama-${theme}-${vp.name}-city-gate.png`,
          animations: 'disabled',
        });
      });
    });
  }
}
