import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICONS, ICON_DATA_FILE, iconDataSource } from '../../scripts/icon-data.ts';
import { ICON_PATHS } from './icon-data.ts';
import { iconSvg } from './icon-svg.ts';

describe('icons', () => {
  it('match the Phosphor package they come from: run `npm run icons` after changing either', async () => {
    expect(readFileSync(ICON_DATA_FILE, 'utf8')).toBe(await iconDataSource());
  });

  it('cover every name the site uses, each a single path on the 256 grid', () => {
    expect(Object.keys(ICON_PATHS).sort()).toEqual(Object.keys(ICONS).sort());
    for (const d of Object.values(ICON_PATHS)) expect(d).toMatch(/^M[\d.,\-\sA-Za-z]+$/);
  });

  it('draw a gas pump for gasoline and a phone for telecom, never a can or Wi-Fi', () => {
    expect(ICONS.fuel).toBe('gas-pump');
    expect(ICONS.telecom).toBe('phone');
  });

  it('are written into static HTML hidden from readers, in the current color', () => {
    const svg = iconSvg('gas');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg).toContain(ICON_PATHS.gas);
  });
});
