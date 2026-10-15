import { test as base, expect, type Page } from '@playwright/test';

/** Waits until a 3D page's view is built and drawing. */
export async function waitReady(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-scene-ready', 'true', {
    timeout: 60_000,
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
