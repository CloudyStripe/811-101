/**
 * The tiny copies written into the pages are of the pictures as they are now: a picture made again
 * (npm run thumbnails) and its copy not, or a copy for a picture that's gone, fails here.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_SOURCES, POSTER_PLACEHOLDERS, STILL_PLACEHOLDERS } from './placeholders.ts';

describe('the tiny copies', () => {
  it('are each of its picture as it is now', () => {
    const entries = Object.entries(PLACEHOLDER_SOURCES);
    expect(entries.length).toBeGreaterThan(0);
    for (const [path, made] of entries) {
      // As scripts/placeholders.ts notes it (pictureHash).
      const now = createHash('sha256')
        .update(readFileSync(`public/${path}`))
        .digest('hex')
        .slice(0, 16);
      expect(now, `${path}: run npm run thumbnails (or node scripts/placeholders.ts)`).toBe(made);
    }
  });

  it('note where each was made from, and only those', () => {
    const copies = Object.keys({ ...STILL_PLACEHOLDERS, ...POSTER_PLACEHOLDERS }).sort();
    expect(Object.keys(PLACEHOLDER_SOURCES).sort()).toEqual(copies);
  });
});
