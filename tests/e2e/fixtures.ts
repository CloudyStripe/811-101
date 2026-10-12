import { test as base, expect, type Page } from '@playwright/test';

/** Hosts the original diorama still loads from. Only that page may use them, until it's ported. */
export const DIORAMA_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

/** The parts of the diorama's test hook (`window.__app`, with #debug in the URL) that tests read. */
export interface DioramaApp {
  camera: { position: { x: number; y: number; z: number } };
  STAGES: {
    id: string;
    label: string;
    title: string;
    text: string;
    note?: string;
    safety?: string;
    terms?: Record<string, string>;
  }[];
  OVERVIEW: { title: string; text: string };
  GLOSSARY: Record<string, string>;
  /** For each tour: [question, options, index of the right option, explanation]. */
  QUIZZES: Record<string, [string, string[], number, string][]>;
  /** [millions of years ago, caption]. */
  TIMELAPSE: [number, string][];
}
export type DioramaWindow = Window & { __app?: DioramaApp };

/** Opens the diorama and waits for its scripts and fonts, so leaving never cuts them short. */
export async function openDiorama(page: Page, hash = ''): Promise<void> {
  await page.goto(`utilities/gas-petroleum/${hash}`);
  await expect(page.getByRole('heading', { name: 'Two fuels, one beginning' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

interface Problems {
  /** Hosts a page may contact besides its own origin. Empty for every new page. */
  allowHosts: string[];
}

/**
 * Every test fails on any console error or warning, uncaught page error, failed request, request
 * to another origin (no CDNs), or page that loads as an error.
 */
export const test = base.extend<Problems>({
  allowHosts: [[], { option: true }],
  page: async ({ page, allowHosts, baseURL }, use) => {
    const problems: string[] = [];
    const origin = new URL(baseURL ?? 'http://localhost').origin;
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
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
      if (url.origin !== origin && !allowHosts.includes(url.hostname)) {
        problems.push(`cross-origin request: ${req.url()}`);
      }
    });
    // A link to a page that isn't there loads an error page, not a failed request.
    page.on('response', (res) => {
      if (res.request().isNavigationRequest() && res.status() >= 400) {
        problems.push(`page not found: ${res.url()} (${String(res.status())})`);
      }
    });
    await use(page);
    expect(problems, 'console, page errors and requests').toEqual([]);
  },
});

export { expect };
