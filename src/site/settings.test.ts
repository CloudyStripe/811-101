import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  BOOT_SCRIPT,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  applyToDocument,
  parseSettings,
  reducesMotion,
} from './settings.ts';

describe('parseSettings', () => {
  it('keeps known values', () => {
    expect(
      parseSettings({ theme: 'dark', motion: 'reduce', quality: 'low', labels: 'off' }),
    ).toEqual({ theme: 'dark', motion: 'reduce', quality: 'low', labels: 'off' });
  });

  it('falls back to defaults for anything missing, unknown or malformed', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('dark')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ theme: 'sepia', motion: 3, quality: 'ultra', labels: 'some' })).toEqual(
      DEFAULT_SETTINGS,
    );
    expect(parseSettings({ theme: 'light' })).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' });
  });
});

describe('reducesMotion', () => {
  it('follows the device unless the setting says otherwise', () => {
    expect(reducesMotion('system', true)).toBe(true);
    expect(reducesMotion('system', false)).toBe(false);
    expect(reducesMotion('reduce', false)).toBe(true);
    expect(reducesMotion('full', true)).toBe(false);
  });
});

describe('applyToDocument', () => {
  it('sets overrides and clears them for "match device"', () => {
    const root = { dataset: {} as DOMStringMap };
    applyToDocument({ ...DEFAULT_SETTINGS, theme: 'dark', motion: 'full' }, root);
    expect(root.dataset).toEqual({ theme: 'dark', motion: 'full' });
    applyToDocument(DEFAULT_SETTINGS, root);
    expect(root.dataset).toEqual({});
  });
});

describe('BOOT_SCRIPT', () => {
  /** Runs the page's boot script against a stored value and returns what it set on <html>. */
  function boot(stored: string | null, storageThrows = false): DOMStringMap {
    const root = { dataset: {} as DOMStringMap };
    const localStorage = {
      getItem(key: string) {
        if (storageThrows) throw new Error('storage is off');
        return key === SETTINGS_KEY ? stored : null;
      },
    };
    runInNewContext(BOOT_SCRIPT, { localStorage, document: { documentElement: root } });
    return root.dataset;
  }

  /** What the page's own code applies once it runs, for the same stored value. */
  function applied(raw: unknown): DOMStringMap {
    const root = { dataset: {} as DOMStringMap };
    applyToDocument(parseSettings(raw), root);
    return root.dataset;
  }

  it('applies the same theme and motion the page applies once its code runs', () => {
    const cases = [
      { theme: 'dark', motion: 'reduce' },
      { theme: 'light', motion: 'full' },
      { theme: 'system', motion: 'system', quality: 'high' },
      { theme: 'sepia', motion: 'sideways' },
      {},
    ];
    for (const saved of cases) expect(boot(JSON.stringify(saved))).toEqual(applied(saved));
  });

  it('leaves the page alone when nothing is saved, the saved value is broken, or storage is off', () => {
    const none = applied(DEFAULT_SETTINGS);
    expect(boot(null)).toEqual(none);
    expect(boot('{not json')).toEqual(none);
    expect(boot('{}', true)).toEqual(none);
  });
});
