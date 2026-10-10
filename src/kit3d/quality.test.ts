import { describe, expect, it } from 'vitest';
import { Governor, guessTier, parseTier, pixelRatioFor } from './quality.ts';

describe('pixelRatioFor', () => {
  it('keeps the rendered size under the tier cap', () => {
    const dpr = pixelRatioFor('medium', 1440, 900, 2);
    expect(1440 * dpr * 900 * dpr).toBeLessThanOrEqual(1.3e6 + 1);
  });

  it('never exceeds the device pixel ratio', () => {
    expect(pixelRatioFor('high', 390, 844, 1)).toBe(1);
  });
});

describe('guessTier', () => {
  it('starts software renderers low', () => {
    expect(guessTier('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))', false)).toBe('low');
  });
  it('starts discrete GPUs high', () => {
    expect(guessTier('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)', false)).toBe('high');
  });
  it('starts integrated GPUs and phones at medium', () => {
    expect(guessTier('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)', false)).toBe(
      'medium',
    );
    expect(guessTier('Apple GPU', true)).toBe('medium');
    expect(guessTier('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)', true)).toBe('medium');
  });
});

describe('parseTier', () => {
  it('accepts known tiers only', () => {
    expect(parseTier('low')).toBe('low');
    expect(parseTier('ultra')).toBeNull();
    expect(parseTier(null)).toBeNull();
  });
});

describe('Governor', () => {
  const feed = (g: Governor, ms: number, from: number, to: number) => {
    let changed = null;
    for (let t = from; t <= to; t += 16) changed = g.sample(ms, t) ?? changed;
    return changed;
  };

  it('steps down when frames are slow', () => {
    const g = new Governor('high', 'high');
    expect(feed(g, 30, 0, 3100)).toBe('medium');
  });

  it('steps up only after sustained fast frames, never above its ceiling', () => {
    const g = new Governor('low', 'medium');
    expect(feed(g, 8, 0, 6000)).toBeNull();
    expect(feed(g, 8, 6016, 16_000)).toBe('medium');
    expect(feed(g, 8, 16_016, 40_000)).toBeNull();
    expect(g.tier).toBe('medium');
  });

  it('never steps below low', () => {
    const g = new Governor('low', 'high');
    expect(feed(g, 50, 0, 10_000)).toBeNull();
  });
});
