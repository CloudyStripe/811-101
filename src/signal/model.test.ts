import { describe, expect, it } from 'vitest';
import { FREQUENCIES } from '../../config/equipment.ts';
import {
  ALL_CONSTANTS,
  CIRCUIT_RESISTANCE_OHMS,
  FADE_PER_100FT,
  GEOMETRY,
  TELECOM_SHARE,
  WORKS_THRESHOLD_MA,
  type PerFrequency,
} from './constants.ts';
import { CONDUCTOR, SETUPS, labState, lowestWorkingFrequency, targetCurrentAt } from './model.ts';

const STATES = SETUPS.flatMap((setup) =>
  FREQUENCIES.map((frequency) => labState(setup, frequency)),
);
const values = (table: PerFrequency) => FREQUENCIES.map((f) => table[f]);
const strictlyFalling = (xs: number[]) => xs.every((v, i) => i === 0 || v < (xs[i - 1] ?? v));
const strictlyRising = (xs: number[]) => xs.every((v, i) => i === 0 || v > (xs[i - 1] ?? v));
const numbersIn = (c: (typeof ALL_CONSTANTS)[number]) =>
  typeof c.value === 'number' ? [c.value] : Object.values(c.value);

describe('constants', () => {
  it('are all documented', () => {
    for (const c of ALL_CONSTANTS) {
      for (const field of [c.name, c.meaning, c.unit, c.why]) expect(field.trim()).not.toBe('');
    }
  });

  it('are finite and positive', () => {
    for (const c of ALL_CONSTANTS) {
      for (const v of numbersIn(c)) expect(Number.isFinite(v) && v > 0, c.name).toBe(true);
    }
  });

  it('keep every share between 0 and 1', () => {
    for (const c of [...Object.values(FADE_PER_100FT), TELECOM_SHARE]) {
      for (const v of numbersIn(c)) expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('put the water crossing inside the block, and the block inside the chart', () => {
    expect(GEOMETRY.waterCrossingAtFt.value).toBeLessThan(GEOMETRY.blockLengthFt.value);
    expect(GEOMETRY.blockLengthFt.value).toBeLessThan(GEOMETRY.chartLengthFt.value);
  });
});

describe('as frequency rises', () => {
  it('both conductors fade sooner', () => {
    expect(strictlyFalling(values(FADE_PER_100FT.steel.value))).toBe(true);
    expect(strictlyFalling(values(FADE_PER_100FT.tracer.value))).toBe(true);
  });

  it.each(SETUPS)('%s: less current reaches the far end of the block', (setup) => {
    expect(strictlyFalling(FREQUENCIES.map((f) => labState(setup, f).farEndMa))).toBe(true);
  });

  it('more of the target current bleeds onto the telecom cable', () => {
    expect(strictlyRising(values(TELECOM_SHARE.value))).toBe(true);
  });
});

describe('the plastic main', () => {
  it('carries the signal on its tracer wire, not the pipe', () => {
    expect(CONDUCTOR.plastic).toBe('tracer');
  });

  it('makes a higher-resistance circuit than the steel main, so less current flows', () => {
    for (const f of FREQUENCIES) {
      expect(CIRCUIT_RESISTANCE_OHMS.plastic.value[f]).toBeGreaterThan(
        CIRCUIT_RESISTANCE_OHMS.steel.value[f],
      );
      expect(labState('plastic', f).transmitter.ma).toBeLessThan(
        labState('steel', f).transmitter.ma,
      );
    }
  });
});

describe('conservation', () => {
  it.each(STATES)('$setup at $frequency Hz: everything that leaves returns to the stake', (s) => {
    const leaked = s.earth.leakage.reduce((sum, p) => sum + p.ma, 0) + s.earth.pastChart;
    expect(leaked).toBeCloseTo(s.transmitter.ma, 9);
    expect(s.earth.stake).toBeCloseTo(s.transmitter.ma, 9);
    expect(s.earth.viaSoil + s.earth.viaTelecom).toBeCloseTo(s.earth.stake, 9);
    for (const p of s.earth.leakage) expect(p.ma).toBeGreaterThanOrEqual(0);
  });

  it.each(STATES)('$setup at $frequency Hz: the telecom share is part of the return', (s) => {
    expect(s.earth.viaTelecom).toBeCloseTo(s.telecom.share * s.transmitter.ma, 9);
    expect(s.earth.viaTelecom).toBeLessThan(s.earth.stake);
  });
});

describe('direction', () => {
  it.each(STATES)('$setup at $frequency Hz: target outgoing, telecom returning', (s) => {
    expect(s.target.direction).toBe(1);
    expect(s.telecom.direction).toBe(-1);
    expect(s.telecom.points).toHaveLength(s.target.points.length);
    s.telecom.points.forEach((p, i) => {
      expect(p.ma).toBeCloseTo(s.telecom.share * (s.target.points[i]?.ma ?? NaN), 9);
    });
  });
});

describe('the rule: use the lowest frequency that works', () => {
  it.each(SETUPS)('%s: 512 Hz works, so it is the one to use', (setup) => {
    expect(lowestWorkingFrequency(setup)).toBe(512);
  });

  it('judges "works" by the documented threshold at the far end of the block', () => {
    for (const s of STATES) {
      expect(s.works).toBe(s.farEndMa >= WORKS_THRESHOLD_MA.value);
      expect(s.farEndMa).toBeCloseTo(
        targetCurrentAt(s.setup, s.frequency, GEOMETRY.blockLengthFt.value),
        9,
      );
    }
  });
});

describe('the water main', () => {
  it.each(STATES)('$setup at $frequency Hz: carries no signal', (s) => {
    expect(s.water.ma).toBe(0);
  });
});

describe('labState', () => {
  it('is deterministic', () => {
    expect(labState('plastic', 33_000)).toEqual(labState('plastic', 33_000));
  });

  it('samples the target from the hookup to the end of the chart', () => {
    const s = labState('steel', 512);
    expect(s.target.points[0]?.x).toBe(0);
    expect(s.target.points.at(-1)?.x).toBe(GEOMETRY.chartLengthFt.value);
    expect(s.target.points[0]?.ma).toBeCloseTo(s.transmitter.ma, 9);
  });
});
