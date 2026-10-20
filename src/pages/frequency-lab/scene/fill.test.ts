/**
 * How deep the lab's ground is drawn for the room the page leaves it: deep enough that the block
 * fills the room's height, shallow in a strip so it fills the strip's width, in half steps within
 * each view's bounds, and kept while the room changes only a little. The framing it leads to is
 * checked, size by size, in layout.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { depthFor } from './fill.ts';
import { VIEW_GROUND } from './layout.ts';

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
const closed = { x: 0, y: 58, width: 1440, height: 717 };

describe('the depth the ground is drawn at', () => {
  it('is a half step within the view’s bounds, for every room', () => {
    for (const height of [120, 240, 348, 500, 717, 840]) {
      const depth = depthFor('wide', { ...closed, height }, desktop);
      expect(depth % 0.5).toBe(0);
      expect(depth).toBeGreaterThanOrEqual(VIEW_GROUND.wide.least);
      expect(depth).toBeLessThanOrEqual(VIEW_GROUND.wide.most);
    }
    const depth = depthFor('tall', { x: 0, y: 58, width: 390, height: 519 }, phone);
    expect(depth).toBeGreaterThanOrEqual(VIEW_GROUND.tall.least);
    expect(depth).toBeLessThanOrEqual(VIEW_GROUND.tall.most);
  });

  it('is deeper the taller the room is for its width', () => {
    const depths = [348, 500, 717, 840].map((height) =>
      depthFor('wide', { ...closed, height }, desktop),
    );
    depths.slice(1).forEach((d, i) => {
      expect(d).toBeGreaterThan(depths[i] ?? Infinity);
    });
  });

  it('is the shallowest in a strip, as above the open guide, and the deepest in a room too tall to fill', () => {
    expect(depthFor('wide', { ...closed, height: 200 }, desktop)).toBe(VIEW_GROUND.wide.least);
    expect(depthFor('wide', { x: 0, y: 0, width: 900, height: 900 }, desktop)).toBe(
      VIEW_GROUND.wide.most,
    );
  });

  it('keeps the depth built while the room asks for nearly the same, and changes it when it asks for more', () => {
    const now = depthFor('wide', closed, desktop);
    expect(depthFor('wide', { ...closed, height: closed.height - 6 }, desktop, now)).toBe(now);
    expect(depthFor('wide', { ...closed, height: closed.height + 6 }, desktop, now)).toBe(now);
    expect(
      depthFor('wide', { ...closed, height: closed.height + 120 }, desktop, now),
    ).toBeGreaterThan(now);
  });

  it('keeps what it has while the page has no size yet', () => {
    expect(depthFor('wide', { ...closed, width: 0 }, desktop, 13)).toBe(13);
    expect(depthFor('wide', closed, { width: 0, height: 0 })).toBe(VIEW_GROUND.wide.least);
  });
});
