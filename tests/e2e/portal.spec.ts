/**
 * The portal and the ways between pages: the home page names the site and says what it is, over a
 * still of the diorama, and its cards show every lesson, with previews in the reader's theme, and
 * say what's coming, all on one desktop screen; a lesson's preview and its loader share a
 * transition; each page has the site header, which leads home and back to the lesson's card; a
 * missing address shows the site's 404 page. The built pages carry their title, share preview,
 * favicons and the settings script before any of their JavaScript runs. Plus axe on the portal
 * and the 404 page, in both themes, with the one hero still each screen loads.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { BRAND, SITE_URL } from '../../config/brand.ts';
import { SECTIONS, type Lesson } from '../../content/portal.ts';
import { THEMES } from '../../src/design/tokens.ts';
import { PAGES, lessonPage, lessonTransition, pageById } from '../../src/site/pages.ts';
import { CARDS_NAME } from '../../src/site/shell.ts';
import { SETTINGS_KEY } from '../../src/site/settings.ts';
import { PREVIEW_SIZE, heroPath, previewPath } from '../../src/site/stills.ts';
import { expect, loadImages, test, waitReady } from './fixtures.ts';

/** Opens the portal and waits until everything on it, previews included, is loaded and decoded. */
async function openPortal(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: BRAND.name, level: 1 })).toBeVisible();
  await loadImages(page);
}

/** The portal's own address, with nothing after it. */
const PORTAL_URL = /\/811-101\/$/;

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
}

test('the portal’s cards show every lesson and section, and what’s coming', async ({ page }) => {
  await openPortal(page);
  await expect(page).toHaveTitle(BRAND.name);
  const cards = page.getByRole('list', { name: CARDS_NAME }).getByRole('listitem');
  const lessons = SECTIONS.flatMap((section) => section.lessons);
  const coming = SECTIONS.filter((section) => section.lessons.length === 0);
  await expect(cards).toHaveCount(lessons.length + coming.length);
  // The lessons first, then what's coming.
  await expect(cards.getByRole('heading', { level: 2 })).toHaveText([
    ...lessons.map((lesson) => lesson.title),
    ...coming.map((section) => section.title),
  ]);
  for (const section of SECTIONS) {
    // A section's first card carries its id, where a lesson's breadcrumb leads.
    const card = page.locator(`#${section.id}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(section.title);
    await expect(card).toContainText(section.summary);
    if (section.lessons.length === 0) {
      await expect(card).toContainText('Coming soon');
      await expect(card.getByRole('link')).toHaveCount(0);
    }
    for (const lesson of section.lessons) {
      const card = cards.filter({
        has: page.getByRole('link', { name: lesson.title, exact: true }),
      });
      await expect(card).toContainText(lesson.summary);
      await expect(card.getByRole('link')).toHaveAttribute('href', `/811-101/${lesson.href}`);
    }
  }
  // The previews are real images, not broken ones.
  for (const img of await page.locator('img.card-image').all()) {
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(PREVIEW_SIZE.width);
  }
});

test('the hero names the site and says what it is, in the sky the screen’s whole width', async ({
  page,
}) => {
  await openPortal(page);
  const hero = page.getByRole('region', { name: BRAND.name });
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText(BRAND.name);
  await expect(hero).toContainText(BRAND.tagline);
  const sky = await hero.boundingBox();
  expect(sky?.x).toBe(0);
  expect(sky?.width).toBe(page.viewportSize()?.width);
});

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a lesson’s breadcrumb lands on its card, the page still at its top', async ({ page }) => {
    await page.goto('./#utilities');
    await loadImages(page);
    await expect(page.locator('#utilities')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('the name stands in the sky beside the whole model, clear of it', async ({ page }) => {
    await openPortal(page);
    const words = await page.locator('.hero-text').boundingBox();
    const model = await page.locator('.hero-image').boundingBox();
    if (!words || !model) throw new Error('no hero');
    expect(words.x + words.width).toBeLessThanOrEqual(model.x);
    // The model's still stands the hero's whole height, so its sky lines up with the page's.
    const hero = await page.locator('.hero').boundingBox();
    expect(model.y).toBe(hero?.y);
    expect(model.height).toBeCloseTo(hero?.height ?? 0, 0);
  });

  test('the portal is one screen: everything but the footer shows without scrolling', async ({
    page,
  }) => {
    await openPortal(page);
    const screen = page.viewportSize()?.height ?? 0;
    for (const part of [
      page.getByRole('heading', { level: 1 }),
      page.locator('.hero-image'),
      ...(await page.getByRole('list', { name: CARDS_NAME }).getByRole('listitem').all()),
    ]) {
      const box = await part.boundingBox();
      expect((box?.y ?? Infinity) + (box?.height ?? 0)).toBeLessThanOrEqual(screen);
    }
  });
});

/** The preview a lesson's card shows: the one in the reader's theme, of the two it holds. */
function shownPreview(page: Page, lesson: Lesson) {
  return page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: lesson.title, exact: true }) })
    .locator('img.card-image:visible');
}

test('a preview shows in the reader’s theme, and carries on into its lesson’s loader', async ({
  page,
}) => {
  await openPortal(page);
  const lessons = SECTIONS.flatMap((section) => section.lessons);
  for (const lesson of lessons) {
    await expect(shownPreview(page, lesson)).toHaveAttribute(
      'src',
      `/811-101/${previewPath(lesson.image, 'light')}`,
    );
    // The card and the lesson's own loader, in its static page, share a name.
    const name = lessonTransition(lessonPage(lesson).id);
    const card = page.locator(`.card[data-transition="${name}"]`);
    await expect(card).toHaveCount(1);
    const html = await (await page.request.get(lesson.href)).text();
    expect(html).toContain(`--lesson-transition: ${name}`);
  }
  // The device's dark theme, and the previews follow it...
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const lesson of lessons) {
    await expect(shownPreview(page, lesson)).toHaveAttribute(
      'src',
      `/811-101/${previewPath(lesson.image, 'dark')}`,
    );
  }
  // ...or the one chosen in the settings, over the device's.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page
    .getByRole('dialog', { name: 'Settings' })
    .getByRole('radio', { name: 'Light' })
    .click();
  for (const lesson of lessons) {
    await expect(shownPreview(page, lesson)).toHaveAttribute(
      'src',
      `/811-101/${previewPath(lesson.image, 'light')}`,
    );
  }
});

test('every built page carries its head and shell before any JavaScript runs', async ({ page }) => {
  for (const info of PAGES) {
    const res = await page.request.get(info.path);
    const html = await res.text();
    expect(html, info.id).toContain(SETTINGS_KEY);
    expect(html, info.id).toContain(`<title>${info.title.replaceAll('&', '&amp;')}</title>`);
    expect(html, info.id).toContain('<header class="site-header"');
    expect(html, info.id).not.toMatch(/%BRAND_|%BASE%/);
    // Its own script holds the first paint, so its controls are in it, and a page change into it
    // animates; and the first screen's fonts are the first thing it asks for, after the settings.
    expect(html.match(/<script type="module" blocking="render"/g), info.id).toHaveLength(1);
    const head = html.slice(html.indexOf(SETTINGS_KEY), html.indexOf('<title>'));
    expect(
      head.match(/<link rel="preload" as="font" type="font\/woff2" crossorigin/g),
      info.id,
    ).toHaveLength(4);
    // Share previews point to whole addresses, and the images are there.
    const image = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
    expect(image, info.id).toBe(`${SITE_URL}share/${info.share.image}`);
    const local = (image ?? '').replace(SITE_URL, '');
    expect((await page.request.get(local)).status(), local).toBe(200);
    for (const icon of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) {
      expect(html, `${info.id} ${icon}`).toContain(`href="/811-101/${icon}"`);
      expect((await page.request.get(icon)).status(), icon).toBe(200);
    }
  }
  // The footer's credits for the open-source software and typefaces the site is built with.
  expect((await page.request.get('credits.txt')).status()).toBe(200);
});

test('a page that isn’t there is a 404, as on the live site, with the site’s own page', async ({
  page,
}) => {
  for (const path of ['training/', 'utilities/', 'no-such-lesson/', 'training/frequency-lab/x/']) {
    const res = await page.request.get(path, { headers: { Accept: 'text/html' } });
    expect(res.status(), path).toBe(404);
    expect(await res.text(), path).toContain('This page isn’t here');
  }
  // A lesson's address without its slash goes on to the slashed one, as on GitHub Pages.
  const bare = await page.request.get('training/frequency-lab?setup=plastic', {
    headers: { Accept: 'text/html' },
    maxRedirects: 0,
  });
  expect(bare.status()).toBe(301);
  expect(bare.headers().location).toBe('/811-101/training/frequency-lab/?setup=plastic');
});

test.describe('the 404 page', () => {
  test.use({ expectNotFound: true });

  test('leads home, by its button and by the header', async ({ page }) => {
    await page.goto('no-such-lesson/');
    await expect(
      page.getByRole('heading', { name: 'This page isn’t here', level: 1 }),
    ).toBeVisible();
    await expect(page).toHaveTitle(pageById('not-found').title);
    await page.getByRole('link', { name: 'Go to all lessons' }).click();
    await expect(page).toHaveURL(PORTAL_URL);
    await page.goto('somewhere/deeper/still/');
    await page.getByRole('link', { name: BRAND.name }).first().click();
    await expect(page).toHaveURL(PORTAL_URL);
  });
});

test('the portal opens the Frequency Lab, and the header leads back', async ({ page }) => {
  // Two loads of the lab, in software.
  test.slow();
  await openPortal(page);
  // The lesson's card on the portal, not the footer's link to it.
  await page.getByRole('main').getByRole('link', { name: 'Frequency Lab', exact: true }).click();
  // The lab adds its setup and frequency to the address.
  await expect(page).toHaveURL(/\/training\/frequency-lab\/(\?|$)/);
  await expect(page.getByRole('heading', { name: 'Frequency Lab', level: 1 })).toBeVisible();
  // Leaving before the lab's 3D code arrives would cut those requests short.
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
  // The breadcrumb leads to the lab's card on the portal...
  await page.getByRole('link', { name: 'Locator Training' }).click();
  await expect(page).toHaveURL(/\/811-101\/#training$/);
  await expect(page.locator('#training')).toBeInViewport();
  // ...and the wordmark, home.
  await page.goto('training/frequency-lab/?tier=low');
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
  await page.getByRole('link', { name: BRAND.name }).click();
  await expect(page).toHaveURL(PORTAL_URL);
  await expect(page).toHaveTitle(BRAND.name);
});

test('settings chosen on one page hold on the next', async ({ page }) => {
  await openPortal(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // The browser's own bar follows the chosen theme.
  const colors = await page.$$eval('meta[name="theme-color"]', (metas) =>
    metas.map((m) => (m as HTMLMetaElement).content),
  );
  expect(new Set(colors)).toEqual(new Set([THEMES.dark.chrome.bg]));
  await page.keyboard.press('Escape');
  await page.goto('training/frequency-lab/?tier=low');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
  });
});

test.describe('the diorama', () => {
  test.use({ reducedMotion: 'reduce' });

  test('opens from Utility Education, and comes back', async ({ page }) => {
    await openPortal(page);
    // The lesson's card on the portal, not the footer's link to it.
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Gas & Petroleum', exact: true })
      .click();
    await expect(page).toHaveURL(/\/utilities\/gas-petroleum\/$/);
    await expect(page).toHaveTitle(pageById('gas-petroleum').title);
    await waitReady(page);
    await page.getByRole('link', { name: BRAND.name }).click();
    await expect(page).toHaveURL(PORTAL_URL);
    await expect(page).toHaveTitle(BRAND.name);
  });
});

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, scale: 1, mobile: false },
  { name: 'phone', width: 390, height: 844, scale: 2, mobile: true },
] as const;

for (const theme of ['light', 'dark'] as const) {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} ${theme}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.scale,
        colorScheme: theme,
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
        reducedMotion: 'reduce',
      });

      test('the portal passes axe, loads its hero only beside the name, and nothing runs off', async ({
        page,
      }) => {
        // On a desktop the hero's still for this theme loads; on a phone, where the hero stacks,
        // none does.
        const heroes: string[] = [];
        page.on('request', (req) => {
          if (req.url().includes('/stills/hero-')) heroes.push(new URL(req.url()).pathname);
        });
        await openPortal(page);
        expect(heroes).toEqual(vp.mobile ? [] : [`/811-101/${heroPath(theme)}`]);
        // The name and its line on the sky, then the cards, the first on the first screen.
        const first = await page.locator('.card').first().boundingBox();
        expect(first?.y ?? Infinity).toBeLessThan(vp.height - 120);
        await expectNoViolations(page);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
      });

      test.describe('404', () => {
        test.use({ expectNotFound: true });

        test('the 404 page passes axe, settings open', async ({ page }) => {
          await page.goto('no-such-lesson/');
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await expectNoViolations(page);
          await page.getByRole('button', { name: 'Settings' }).click();
          await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
          await expectNoViolations(page);
          await page.screenshot({ path: `artifacts/screenshots/404-${theme}-${vp.name}.png` });
        });
      });
    });
  }
}
