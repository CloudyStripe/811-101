import { describe, expect, it } from 'vitest';
import { FREQUENCIES } from '../../../config/equipment.ts';
import { SETUPS } from '../../signal/model.ts';
import { ruleSummary, stateSummary } from './summary.ts';

describe('stateSummary', () => {
  it('names the setup and frequency, then says what the signal does', () => {
    expect(stateSummary('steel', 83_000)).toBe(
      'Steel main at 83 kHz: the signal fades out before the end of the block, and much more of it bleeds onto the telecom cable.',
    );
  });

  it.each(FREQUENCIES)(
    'on the plastic main at %i Hz, says first that the tracer wire carries the signal',
    (f) => {
      expect(stateSummary('plastic', f)).toMatch(
        /^Plastic main at [\d.]+ k?Hz: the tracer wire carries the signal\. The signal /,
      );
    },
  );

  it('reads the plastic main in full', () => {
    expect(stateSummary('plastic', 512)).toBe(
      'Plastic main at 512 Hz: the tracer wire carries the signal. The signal reaches the end of the block, and almost none of it bleeds onto the telecom cable.',
    );
  });

  it('reads as plain text, with no term markup and no numbers beyond the names', () => {
    for (const s of SETUPS) {
      for (const f of FREQUENCIES) {
        const text = stateSummary(s, f);
        expect(text).not.toMatch(/\[\[|\]\]/);
        expect(text.split(': ')[1]).not.toMatch(/\d/);
      }
    }
  });
});

describe('ruleSummary', () => {
  it.each(SETUPS)('%s: names the lowest frequency that works', (s) => {
    expect(ruleSummary(s)).toBe("Here, that's 512 Hz.");
  });
});
