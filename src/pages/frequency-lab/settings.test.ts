import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, applyToDocument, parseSettings, reducesMotion } from './settings.ts';

describe('parseSettings', () => {
  it('keeps known values', () => {
    expect(parseSettings({ theme: 'dark', motion: 'reduce', quality: 'low' })).toEqual({
      theme: 'dark',
      motion: 'reduce',
      quality: 'low',
    });
  });

  it('falls back to defaults for anything missing, unknown or malformed', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('dark')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ theme: 'sepia', motion: 3, quality: 'ultra' })).toEqual(
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
    applyToDocument({ theme: 'dark', motion: 'full', quality: 'auto' }, root);
    expect(root.dataset).toEqual({ theme: 'dark', motion: 'full' });
    applyToDocument(DEFAULT_SETTINGS, root);
    expect(root.dataset).toEqual({});
  });
});
