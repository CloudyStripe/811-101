import { describe, expect, it } from 'vitest';
import { feetAndMeters, formatMa, percent } from './format.ts';

describe('formatMa', () => {
  it('shows large currents whole and small ones to two significant digits', () => {
    expect(formatMa(455.4)).toBe('455');
    expect(formatMa(9.87)).toBe('9.9');
    expect(formatMa(0.0391)).toBe('0.039');
    expect(formatMa(0.004)).toBe('under 0.01');
  });
});

describe('feetAndMeters', () => {
  it('gives meters in parentheses, rounded', () => {
    expect(feetAndMeters(170)).toBe('170 ft (52 m)');
    expect(feetAndMeters(500)).toBe('500 ft (152 m)');
  });
});

describe('percent', () => {
  it('rounds to a whole percent', () => {
    expect(percent(0.0704)).toBe('7%');
    expect(percent(0.995)).toBe('100%');
  });
});
