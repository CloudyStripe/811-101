import { describe, expect, it } from 'vitest';
import { parseTerms, plainText, termKey, termKeysIn } from './terms.ts';

describe('parseTerms', () => {
  it('leaves plain text alone', () => {
    expect(parseTerms('No terms here.')).toEqual([{ kind: 'text', text: 'No terms here.' }]);
  });

  it('marks [[term]], keyed by its words', () => {
    expect(parseTerms('Hook up the [[Ground Stake]] first.')).toEqual([
      { kind: 'text', text: 'Hook up the ' },
      { kind: 'term', text: 'Ground Stake', key: 'ground stake' },
      { kind: 'text', text: ' first.' },
    ]);
  });

  it('shows other words with [[shown|key]]', () => {
    expect(parseTerms('Signal can [[bleed over|bleed-over]].')).toEqual([
      { kind: 'text', text: 'Signal can ' },
      { kind: 'term', text: 'bleed over', key: 'bleed-over' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('handles terms side by side and at the edges', () => {
    expect(parseTerms('[[a]][[b|c]]').map((s) => s.text)).toEqual(['a', 'b']);
  });
});

describe('helpers', () => {
  it('normalize keys', () => {
    expect(termKey('  Tracer   Wire ')).toBe('tracer wire');
  });

  it('strip markup for plain text', () => {
    expect(plainText('The [[transmitter]] puts [[current|signal current]] on the line.')).toBe(
      'The transmitter puts current on the line.',
    );
  });

  it('list every marked key', () => {
    expect(termKeysIn('[[Frequency]] and [[bleed over|bleed-over]]')).toEqual([
      'frequency',
      'bleed-over',
    ]);
  });
});
