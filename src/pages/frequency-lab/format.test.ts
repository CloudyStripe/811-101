import { describe, expect, it } from 'vitest';
import { formatMa, niceCeil, percent } from './format.ts';

describe('niceCeil', () => {
  it('rounds up to a tidy maximum', () => {
    expect(niceCeil(510)).toBe(600);
    expect(niceCeil(96)).toBe(100);
    expect(niceCeil(100)).toBe(100);
    expect(niceCeil(101)).toBe(120);
  });
});

describe('formatMa', () => {
  it('shows large currents whole and small ones to two significant digits', () => {
    expect(formatMa(455.4)).toBe('455');
    expect(formatMa(9.87)).toBe('9.9');
    expect(formatMa(0.0391)).toBe('0.039');
    expect(formatMa(0.004)).toBe('under 0.01');
  });
});

describe('percent', () => {
  it('rounds to a whole percent', () => {
    expect(percent(0.0704)).toBe('7%');
    expect(percent(0.995)).toBe('100%');
  });
});
