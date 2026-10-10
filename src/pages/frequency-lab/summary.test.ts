import { describe, expect, it } from 'vitest';
import { FREQUENCIES } from '../../../config/equipment.ts';
import { GEOMETRY } from '../../signal/constants.ts';
import { SETUPS, reachFt } from '../../signal/model.ts';
import { feetAndMeters } from './format.ts';
import { reachSummary, ruleSummary, stateSummary } from './summary.ts';

const percents = (text: string) => [...text.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));

describe('stateSummary', () => {
  it('names the setup and frequency', () => {
    expect(stateSummary('steel', 83_000)).toMatch(/^Steel main at 83 kHz: /);
    expect(stateSummary('plastic', 512)).toMatch(/^Plastic main at 512 Hz: /);
    expect(stateSummary('plastic', 512)).toContain('as much as the tracer wire');
  });

  it.each(SETUPS)(
    '%s: less is left at the far end and more bleeds over as frequency rises',
    (s) => {
      const rows = FREQUENCIES.map((f) => percents(stateSummary(s, f)));
      const left = rows.map((r) => r[0] ?? NaN);
      const bleed = rows.map((r) => r[1] ?? NaN);
      expect(left).toEqual([...left].sort((a, b) => b - a));
      expect(bleed).toEqual([...bleed].sort((a, b) => a - b));
      expect(new Set(left).size).toBe(left.length);
    },
  );
});

describe('reachSummary', () => {
  it('says when the signal outlasts the chart', () => {
    expect(reachSummary('steel', 512)).toBe(
      `Still strong enough to trace at ${feetAndMeters(GEOMETRY.chartLengthFt.value)}.`,
    );
  });

  it('rounds a shorter reach to the nearest 10 ft', () => {
    const reach = reachFt('steel', 83_000);
    expect(reach).toBeLessThan(GEOMETRY.chartLengthFt.value);
    expect(reachSummary('steel', 83_000)).toBe(
      `Strong enough to trace for about ${feetAndMeters(Math.round(reach / 10) * 10)}.`,
    );
  });
});

describe('ruleSummary', () => {
  it.each(SETUPS)('%s: names the lowest frequency that works', (s) => {
    expect(ruleSummary(s)).toBe("Here, that's 512 Hz.");
  });
});

describe('every state', () => {
  it('fills in every placeholder', () => {
    for (const s of SETUPS) {
      for (const f of FREQUENCIES) expect(stateSummary(s, f)).not.toMatch(/\{\w+\}/);
    }
  });
});
