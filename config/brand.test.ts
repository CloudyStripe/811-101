import { describe, expect, it } from 'vitest';
import { BASE_PATH, SITE_URL, escapeHtml } from './brand.ts';

describe('escapeHtml', () => {
  it('escapes what would break out of HTML text or an attribute', () => {
    expect(escapeHtml('Gas & Petroleum <"quoted">')).toBe(
      'Gas &amp; Petroleum &lt;&quot;quoted&quot;&gt;',
    );
  });
});

describe('where the site lives', () => {
  it('is a whole https address whose path is the build’s base path', () => {
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+\/.*\/$/);
    expect(BASE_PATH).toBe('/811-101/');
  });
});
