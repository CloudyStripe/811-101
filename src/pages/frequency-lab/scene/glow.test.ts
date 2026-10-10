import { describe, expect, it } from 'vitest';
import { FREQUENCIES } from '../../../../config/equipment.ts';
import { WORKS_THRESHOLD_MA } from '../../../signal/constants.ts';
import { SETUPS, reachFt, targetCurrentAt, transmitterReading } from '../../../signal/model.ts';
import { traceGlow } from './glow.ts';

const THRESHOLD = WORKS_THRESHOLD_MA.value;

describe('traceGlow', () => {
  it('is dark at or below the trace threshold and full at the strongest current', () => {
    expect(traceGlow(THRESHOLD, 500, THRESHOLD)).toBe(0);
    expect(traceGlow(THRESHOLD / 2, 500, THRESHOLD)).toBe(0);
    expect(traceGlow(500, 500, THRESHOLD)).toBe(1);
    expect(traceGlow(900, 500, THRESHOLD)).toBe(1);
  });

  it('brightens steadily with current', () => {
    const glows = [25, 50, 100, 200, 400].map((ma) => traceGlow(ma, 500, THRESHOLD));
    expect(glows).toEqual([...glows].sort((a, b) => a - b));
    expect(new Set(glows).size).toBe(glows.length);
  });

  it('goes dark along the line exactly where the signal stops being traceable', () => {
    for (const setup of SETUPS) {
      const strongest = Math.max(...FREQUENCIES.map((f) => transmitterReading(setup, f).ma));
      for (const f of FREQUENCIES) {
        const reach = reachFt(setup, f);
        expect(
          traceGlow(targetCurrentAt(setup, f, reach * 0.98), strongest, THRESHOLD),
        ).toBeGreaterThan(0);
        expect(traceGlow(targetCurrentAt(setup, f, reach * 1.02), strongest, THRESHOLD)).toBe(0);
      }
    }
  });
});
