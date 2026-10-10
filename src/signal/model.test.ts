import { describe, expect, it } from 'vitest';
import { FREQUENCIES } from '../../config/equipment.ts';
import {
  ALL_CONSTANTS,
  BREAK_CROSSING_SHARE,
  FADE_PER_100FT,
  GEOMETRY,
  TELECOM_SHARE,
  WORKS_THRESHOLD_MA,
  type PerFrequency,
} from './constants.ts';
import { SETUPS, labState, lowestWorkingFrequency, targetCurrentAt } from './model.ts';

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
    const shares = [...Object.values(FADE_PER_100FT), TELECOM_SHARE, BREAK_CROSSING_SHARE];
    for (const c of shares) for (const v of numbersIn(c)) expect(v).toBeLessThanOrEqual(1);
  });

  it('put the break and the water crossing inside the block', () => {
    expect(GEOMETRY.breakAtFt.value).toBeLessThan(GEOMETRY.blockLengthFt.value);
    expect(GEOMETRY.waterCrossingAtFt.value).toBeLessThan(GEOMETRY.blockLengthFt.value);
    expect(GEOMETRY.blockLengthFt.value).toBeLessThan(GEOMETRY.chartLengthFt.value);
  });
});

describe('as frequency rises', () => {
  it('both line types fade sooner', () => {
    expect(strictlyFalling(values(FADE_PER_100FT.steel.value))).toBe(true);
    expect(strictlyFalling(values(FADE_PER_100FT.tracer.value))).toBe(true);
  });

  it('the steel main carries less current to the far end of the block', () => {
    expect(strictlyFalling(FREQUENCIES.map((f) => labState('steel', f).farEndMa))).toBe(true);
  });

  it('more of the target current bleeds onto the telecom cable', () => {
    expect(strictlyRising(values(TELECOM_SHARE.value))).toBe(true);
  });

  it('more of the tracer current crosses the break', () => {
    expect(strictlyRising(values(BREAK_CROSSING_SHARE.value))).toBe(true);
  });

  it('the broken-tracer circuit improves: resistance falls and current rises', () => {
    const readings = FREQUENCIES.map((f) => labState('tracer', f).transmitter);
    expect(strictlyFalling(readings.map((r) => r.ohms))).toBe(true);
    expect(strictlyRising(readings.map((r) => r.ma))).toBe(true);
  });
});

describe('conservation', () => {
  it.each(STATES)('$setup at $frequency Hz: everything that leaves returns to the stake', (s) => {
    const leaked =
      s.earth.leakage.reduce((sum, p) => sum + p.ma, 0) + s.earth.atBreak + s.earth.pastChart;
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
  it('is 512 Hz on the steel main', () => {
    expect(lowestWorkingFrequency('steel')).toBe(512);
  });

  it('is 33 kHz on the broken tracer', () => {
    expect(lowestWorkingFrequency('tracer')).toBe(33_000);
    expect(labState('tracer', 512).works).toBe(false);
    expect(labState('tracer', 8_000).works).toBe(false);
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

describe('the break', () => {
  it('passes on its crossing share and leaks the rest at the break', () => {
    for (const f of FREQUENCIES) {
      const s = labState('tracer', f);
      const at = GEOMETRY.breakAtFt.value;
      const near = s.target.points.find((p) => p.x === at)?.ma ?? NaN;
      const far = s.target.points.findLast((p) => p.x === at)?.ma ?? NaN;
      expect(far).toBeCloseTo(near * BREAK_CROSSING_SHARE.value[f], 9);
      expect(s.earth.atBreak).toBeCloseTo(near - far, 9);
      expect(s.break?.at).toBe(at);
    }
  });

  it('only exists in the tracer setup', () => {
    for (const f of FREQUENCIES) {
      const s = labState('steel', f);
      expect(s.break).toBeNull();
      expect(s.earth.atBreak).toBe(0);
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
    expect(labState('tracer', 33_000)).toEqual(labState('tracer', 33_000));
  });

  it('samples the target from the hookup to the end of the chart', () => {
    const s = labState('steel', 512);
    expect(s.target.points[0]?.x).toBe(0);
    expect(s.target.points.at(-1)?.x).toBe(GEOMETRY.chartLengthFt.value);
    expect(s.target.points[0]?.ma).toBeCloseTo(s.transmitter.ma, 9);
  });
});
