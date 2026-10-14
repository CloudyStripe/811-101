/**
 * Display settings, shared by every page: the only things the site remembers between visits.
 * They're kept in localStorage when it's available, and the site works the same without it.
 */
import { THEMES, type ThemeName } from '../design/tokens.ts';
import { parseTier, type Tier } from '../kit3d/quality.ts';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type MotionSetting = 'system' | 'reduce' | 'full';
export type QualitySetting = 'auto' | Tier;

export interface Settings {
  theme: ThemeSetting;
  motion: MotionSetting;
  quality: QualitySetting;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', motion: 'system', quality: 'auto' };

export const SETTINGS_KEY = '811-101.settings';

/**
 * A script for each page's <head> that applies saved theme and motion before first paint, so the
 * page doesn't flash. The site shell adds it to every page (src/site/shell.ts); the page's own
 * code applies the settings again once it runs.
 *
 * It also listens for page changes: one the browser gives up on animating just happens, as
 * Chromium sometimes does when a link is followed the moment a page loads. The transition's
 * promises then reject, harmlessly, and would otherwise be reported as uncaught errors. And the
 * header, which holds still between pages, takes part only when it's on screen: on a scrolled page
 * it has gone, and would otherwise slide back in.
 */
export function bootScript(): string {
  return `try {
  var saved = JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)}) || '{}');
  if (saved.theme === 'light' || saved.theme === 'dark') document.documentElement.dataset.theme = saved.theme;
  if (saved.motion === 'reduce' || saved.motion === 'full') document.documentElement.dataset.motion = saved.motion;
} catch (e) {}
if (typeof addEventListener === 'function') {
  ['pageswap', 'pagereveal'].forEach(function (type) {
    addEventListener(type, function (event) {
      var t = event.viewTransition;
      if (!t) return;
      [t.ready, t.finished, t.updateCallbackDone].forEach(function (p) { p.catch(function () {}); });
      var header = document.querySelector('.site-header');
      if (header && scrollY > 0) header.style.viewTransitionName = 'none';
    });
  });
  addEventListener('unhandledrejection', function (event) {
    var r = event.reason;
    if (r && r.name === 'InvalidStateError' && /Transition was aborted/.test(r.message)) event.preventDefault();
  });
}`;
}

export const BOOT_SCRIPT = bootScript();

function pick<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.find((o) => o === value) ?? fallback;
}

/** Settings from stored JSON, falling back to defaults for anything missing or unknown. */
export function parseSettings(raw: unknown): Settings {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const tier = typeof r.quality === 'string' ? parseTier(r.quality) : null;
  return {
    theme: pick(r.theme, ['system', 'light', 'dark'], 'system'),
    motion: pick(r.motion, ['system', 'reduce', 'full'], 'system'),
    quality: tier ?? 'auto',
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return parseSettings(raw === null ? null : JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be off or full. The setting still applies for this visit.
  }
}

/**
 * Theme and motion overrides go on <html>, where the token CSS reads them. A chosen theme also
 * sets the browser's own bar color (theme-color), which otherwise follows the device.
 */
export function applyToDocument(
  settings: Settings,
  root: Pick<HTMLElement, 'dataset'> = document.documentElement,
): void {
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  if (settings.motion === 'system') delete root.dataset.motion;
  else root.dataset.motion = settings.motion;
  if (typeof document === 'undefined') return;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own: ThemeName = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEMES[settings.theme === 'system' ? own : settings.theme].chrome.bg;
  }
}

type Listener = (settings: Settings) => void;
let current: Settings | null = null;
const listeners = new Set<Listener>();

/** The settings in effect: saved ones, or the defaults. */
export function getSettings(): Settings {
  current ??= loadSettings();
  return current;
}

/**
 * Changes the settings everywhere at once: on the page, in the header's menu, and for the next
 * visit. Each part of the page that cares subscribes.
 */
export function setSettings(next: Settings, save = true): void {
  current = next;
  if (save) saveSettings(next);
  applyToDocument(next);
  for (const listener of listeners) listener(next);
}

export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Settings changed in another tab apply here too. */
export function followOtherTabs(): void {
  window.addEventListener('storage', (event) => {
    if (event.key === SETTINGS_KEY) setSettings(loadSettings(), false);
  });
}

/** Whether to reduce motion, given the setting and the device's own preference. */
export function reducesMotion(motion: MotionSetting, deviceReduces: boolean): boolean {
  return motion === 'reduce' || (motion === 'system' && deviceReduces);
}
