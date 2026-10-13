import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_PATH, BRAND, SITE_URL, fillBrand } from './brand.ts';

describe('fillBrand', () => {
  it('fills the portal page’s name and tagline, leaving no placeholder behind', () => {
    const html = fillBrand(readFileSync('index.html', 'utf8')).replaceAll(/\s+/g, ' ');
    expect(html).toContain(`<h1>${BRAND.name}</h1>`);
    expect(html).toContain(BRAND.tagline);
    expect(html).not.toContain('%BRAND_');
  });

  it('escapes the brand for HTML', () => {
    expect(fillBrand('<b>%BRAND_NAME%</b>')).toBe(`<b>${BRAND.name}</b>`);
    expect(fillBrand('%BRAND_NAME%')).not.toMatch(/[<>"]/);
  });
});

describe('where the site lives', () => {
  it('is a whole https address whose path is the build’s base path', () => {
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+\/.*\/$/);
    expect(BASE_PATH).toBe('/811-101/');
  });
});
