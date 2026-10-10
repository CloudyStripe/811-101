/**
 * Display settings: the only things the lab remembers between visits. They're kept in
 * localStorage when it's available, and the lab works the same without it.
 */
import { parseTier, type Tier } from '../../kit3d/quality.ts';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type MotionSetting = 'system' | 'reduce' | 'full';
export type QualitySetting = 'auto' | Tier;

export interface Settings {
  theme: ThemeSetting;
  motion: MotionSetting;
  quality: QualitySetting;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', motion: 'system', quality: 'auto' };

/** Also read by the inline script in the page, which applies theme and motion before first paint. */
export const SETTINGS_KEY = '811-101.settings';

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

/** Theme and motion overrides go on <html>, where the token CSS reads them. */
export function applyToDocument(
  settings: Settings,
  root: Pick<HTMLElement, 'dataset'> = document.documentElement,
): void {
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  if (settings.motion === 'system') delete root.dataset.motion;
  else root.dataset.motion = settings.motion;
}

/** Whether to reduce motion, given the setting and the device's own preference. */
export function reducesMotion(motion: MotionSetting, deviceReduces: boolean): boolean {
  return motion === 'reduce' || (motion === 'system' && deviceReduces);
}
