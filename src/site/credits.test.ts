import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREDITED, CREDITS_FILE, creditsText } from '../../scripts/credits.ts';
import { footerHtml } from './shell.ts';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>;
};

describe('open-source credits', () => {
  it('match the installed packages: run `npm run credits` after changing them', () => {
    expect(readFileSync(CREDITS_FILE, 'utf8')).toBe(creditsText());
  });

  it('credit every package the site ships, and the icons', () => {
    const credited = CREDITED.map((c) => c.name);
    for (const name of Object.keys(pkg.dependencies)) expect(credited).toContain(name);
    expect(credited).toContain('@phosphor-icons/core');
  });

  it('are linked from the footer', () => {
    expect(footerHtml()).toContain('href="/811-101/credits.txt">Open-source credits</a>');
  });
});

/** A PNG's size, from its header. */
function pngSize(file: string): { width: number; height: number } {
  const data = readFileSync(file);
  expect(data.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe('favicons', () => {
  it('show the wordmark tile, ink by day and chalk by night', () => {
    const svg = readFileSync('public/favicon.svg', 'utf8');
    expect(svg).toContain('prefers-color-scheme:dark');
    expect(svg.match(/<image class="(light|dark)"/g)).toHaveLength(2);
  });

  it('come as a 32 px PNG and a 180 px home-screen icon', () => {
    expect(pngSize('public/favicon-32.png')).toEqual({ width: 32, height: 32 });
    expect(pngSize('public/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
  });
});
